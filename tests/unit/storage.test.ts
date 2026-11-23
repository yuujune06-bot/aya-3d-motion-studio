import { promises as fs } from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { StorageService } from '../../src/main/services/StorageService'

let scratch: string
let storage: StorageService
beforeEach(async () => {
  const parent = path.resolve('work/storage-tests')
  await fs.mkdir(parent, { recursive: true })
  scratch = await fs.mkdtemp(path.join(parent, 'case-'))
  storage = await StorageService.open(path.join(scratch, '保存先 空白'))
})
afterEach(async () => {
  vi.restoreAllMocks()
  await fs.rm(scratch, { recursive: true, force: true })
})

describe('U-01 原子的保存', () => {
  it.each(
    ['EPERM', 'EBUSY', 'EACCES'].flatMap((code) =>
      ['copyFile', 'rename'].map((operation) => ({ code, operation })),
    ),
  )('$operationの$codeが2回続いた後、3回目で保存できる', async ({ code, operation }) => {
    await storage.writeJsonAtomic('retry.json', { value: 'original' })
    const target = await storage.resolveInRoot('retry.json')
    let attempts = 0
    const error = Object.assign(new Error('temporary lock'), { code })
    if (operation === 'copyFile') {
      const copy = fs.copyFile.bind(fs)
      vi.spyOn(fs, 'copyFile').mockImplementation(
        async (...args: Parameters<typeof fs.copyFile>) => {
          if (++attempts <= 2) throw error
          await copy(...args)
        },
      )
    } else {
      const rename = fs.rename.bind(fs)
      vi.spyOn(fs, 'rename').mockImplementation(async (from, to) => {
        if (String(to) === target && ++attempts <= 2) throw error
        await rename(from, to)
      })
    }
    await storage.writeJsonAtomic('retry.json', { value: 'saved' })
    expect(attempts).toBe(3)
    const schema = z.object({ value: z.string() })
    expect(await storage.readJson('retry.json', schema)).toEqual({ value: 'saved' })
    expect(await storage.readJson('retry.json.bak', schema)).toEqual({ value: 'original' })
  })
  it('5回のリトライで直らなければ失敗を返し、元のJSONを保持する', async () => {
    await storage.writeJsonAtomic('retry-limit.json', { value: 'original' })
    const copy = vi
      .spyOn(fs, 'copyFile')
      .mockRejectedValue(Object.assign(new Error('locked'), { code: 'EBUSY' }))
    await expect(storage.writeJsonAtomic('retry-limit.json', { value: 'new' })).rejects.toThrow(
      'locked',
    )
    expect(copy).toHaveBeenCalledTimes(6)
    expect(await storage.readJson('retry-limit.json', z.object({ value: z.string() }))).toEqual({
      value: 'original',
    })
  })
  it('一時ファイルの書き込み途中で失敗しても本体と既存.bakが壊れない', async () => {
    await storage.writeJsonAtomic('project.json', { value: '世代1' })
    await storage.writeJsonAtomic('project.json', { value: '世代2' })
    const open = fs.open.bind(fs)
    vi.spyOn(fs, 'open').mockImplementation(async (...args: Parameters<typeof fs.open>) => {
      const handle = await open(...args)
      if (String(args[0]).endsWith('project.json.tmp')) {
        vi.spyOn(handle, 'writeFile').mockImplementation(async () => {
          await handle.write('{ partial')
          throw new Error('interrupted write')
        })
      }
      return handle
    })
    await expect(storage.writeJsonAtomic('project.json', { value: '世代3' })).rejects.toThrow(
      'interrupted write',
    )
    const schema = z.object({ value: z.string() })
    expect(await storage.readJson('project.json', schema)).toEqual({ value: '世代2' })
    expect(await storage.readJson('project.json.bak', schema)).toEqual({ value: '世代1' })
  })
  it('置換時に例外が起きても元のJSONが無傷で、.bakを保持する', async () => {
    await storage.writeJsonAtomic('project.json', { value: '元のデータ' })
    const file = await storage.resolveInRoot('project.json')
    const original = await fs.readFile(file)
    const rename = fs.rename.bind(fs)
    vi.spyOn(fs, 'rename').mockImplementation(async (from, to) => {
      if (String(to) === file) throw new Error('simulated interrupted replacement')
      await rename(from, to)
    })
    await expect(storage.writeJsonAtomic('project.json', { value: '変更後' })).rejects.toThrow(
      'interrupted',
    )
    expect(await fs.readFile(file)).toEqual(original)
    expect(await fs.readFile(file + '.bak')).toEqual(original)
    expect(await storage.exists('project.json.tmp')).toBe(false)
  })
  it('連続保存は順番に置換し、.bakは直前の1世代になる', async () => {
    await Promise.all([1, 2, 3].map((value) => storage.writeJsonAtomic('project.json', { value })))
    expect(await storage.readJson('project.json', z.object({ value: z.number() }))).toEqual({
      value: 3,
    })
    expect(await storage.readJson('project.json.bak', z.object({ value: z.number() }))).toEqual({
      value: 2,
    })
  })
  it('不正なJSONやスキーマ不一致では復旧を案内するエラーを返す', async () => {
    await fs.writeFile(await storage.resolveInRoot('broken.json'), '{ broken')
    await expect(
      storage.readJson('broken.json', z.object({ value: z.number() })),
    ).rejects.toMatchObject({ code: 'INVALID_JSON' })
    await storage.writeJsonAtomic('wrong.json', { value: 'wrong type' })
    await expect(
      storage.readJson('wrong.json', z.object({ value: z.number() })),
    ).rejects.toMatchObject({ code: 'INVALID_JSON' })
  })
})
describe('U-02 パス境界', () => {
  it.each([
    '../outside',
    '..\\..\\Windows',
    'C:\\Windows',
    'C:relative',
    '/etc/passwd',
    '\\\\host\\share',
    'projects/../../outside',
    'file:stream',
    'nul.json',
    'folder./file',
    'folder /file',
    'a//b',
    '',
    'a/./b',
    'bad\u0000name',
  ])('%jを拒否する', async (relative) => {
    await expect(storage.resolveInRoot(relative)).rejects.toMatchObject({ code: 'UNSAFE_PATH' })
  })
  it('日本語と空白を許可する', async () => {
    expect(await storage.resolveInRoot('日本語 空白/保存.json')).toBe(
      path.join(storage.root, '日本語 空白', '保存.json'),
    )
  })
  it('リンクを示すlstat結果を拒否する', async () => {
    const lstat = fs.lstat.bind(fs)
    vi.spyOn(fs, 'lstat').mockImplementation((...args: Parameters<typeof fs.lstat>) => {
      if (String(args[0]) === path.join(storage.root, 'link')) {
        return Promise.resolve({ isSymbolicLink: () => true }) as ReturnType<typeof fs.lstat>
      }
      return lstat(...args)
    })
    await expect(storage.resolveInRoot('link/secret.json')).rejects.toMatchObject({
      code: 'UNSAFE_PATH',
    })
  })
  it('実際の外向きjunctionを拒否する（作成権限が必要）', async (context) => {
    const outside = path.join(scratch, 'outside')
    await fs.mkdir(outside)
    try {
      await fs.symlink(
        outside,
        path.join(storage.root, 'link'),
        process.platform === 'win32' ? 'junction' : 'dir',
      )
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EPERM') {
        context.skip(true, 'OSがリンク作成を拒否したため、実junctionの検証は未実施')
        return
      }
      throw error
    }
    await expect(storage.resolveInRoot('link/secret.json')).rejects.toMatchObject({
      code: 'UNSAFE_PATH',
    })
  })
})
describe('U-03 移行の仕組み', () => {
  const v0Schema = z.object({ schemaVersion: z.literal(0), name: z.string() }).strict()
  const v1Schema = z.object({ schemaVersion: z.literal(1), title: z.string() }).strict()
  const migrate = (raw: unknown): unknown => {
    const old = v0Schema.safeParse(raw)
    return old.success ? { schemaVersion: 1, title: old.data.name } : raw
  }

  it('v0フィクスチャをv1へ移行し、原本はその後の保存でも残る', async () => {
    const file = 'migration.json'
    await storage.writeJsonAtomic(file, { schemaVersion: 0, name: '移行前の名前' })
    const original = await fs.readFile(await storage.resolveInRoot(file))

    const migrated = await storage.readJson(file, v1Schema, migrate)
    expect(migrated).toEqual({ schemaVersion: 1, title: '移行前の名前' })
    expect(await storage.readJson(file, v1Schema)).toEqual(migrated)
    expect(await fs.readFile(await storage.resolveInRoot(file + '.v0.bak'))).toEqual(original)

    await storage.writeJsonAtomic(file, { ...migrated, title: '移行後に編集' })
    expect(await fs.readFile(await storage.resolveInRoot(file + '.v0.bak'))).toEqual(original)
    expect((await storage.readJson(file, v1Schema)).title).toBe('移行後に編集')
  })
  it('未知の将来バージョンは書き換えない', async () => {
    const file = 'migration.json'
    await storage.writeJsonAtomic(file, { schemaVersion: 2, title: '将来形式' })
    const original = await fs.readFile(await storage.resolveInRoot(file))
    await expect(storage.readJson(file, v1Schema, migrate)).rejects.toMatchObject({
      code: 'INVALID_JSON',
    })
    expect(await fs.readFile(await storage.resolveInRoot(file))).toEqual(original)
  })
})
