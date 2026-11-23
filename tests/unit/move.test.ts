import { promises as fs } from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { StorageService } from '../../src/main/services/StorageService'
import { moveByCopy } from '../../src/main/services/StorageMove'
import { fingerprint } from '../../src/main/services/StorageVerification'

let scratch: string
let storage: StorageService
const from = 'items/sample'
const to = 'trash/sample'
let original: string
beforeEach(async () => {
  const parent = path.resolve('work/move-tests')
  await fs.mkdir(parent, { recursive: true })
  scratch = await fs.mkdtemp(path.join(parent, 'case-'))
  storage = await StorageService.open(scratch)
  await storage.ensureDirectory('trash')
  await storage.writeJsonAtomic(`${from}/item.json`, { title: '移動テスト' })
  await storage.ensureDirectory(`${from}/images/空のフォルダー`)
  await fs.writeFile(
    await storage.resolveInRoot(`${from}/images/frame.bin`),
    Buffer.from([0, 1, 2, 255]),
  )
  original = await fingerprint(storage, from)
})
afterEach(async () => {
  vi.restoreAllMocks()
  await fs.rm(scratch, { recursive: true, force: true })
})

it('renameが毎回EPERMでもコピーを照合して元を削除し、ゴミ箱へ移動する', async () => {
  const rename = vi
    .spyOn(fs, 'rename')
    .mockRejectedValue(Object.assign(new Error('OneDrive lock'), { code: 'EPERM' }))
  await storage.move(from, to)
  expect(rename).toHaveBeenCalledTimes(6)
  expect(await storage.exists(from)).toBe(false)
  const trash = await storage.directories('trash')
  expect(trash).toHaveLength(1)
  expect(await fingerprint(storage, `trash/${trash[0]}`)).toBe(original)
  expect(await storage.directories('items')).toEqual([])
})

it.each(['none', 'some', 'all'])(
  '元の削除が失敗したらコピー先を消し元に戻す（削除済み=%s）',
  async (removed) => {
    vi.spyOn(fs, 'rename').mockRejectedValue(
      Object.assign(new Error('OneDrive lock'), { code: 'EPERM' }),
    )
    const source = await storage.resolveInRoot(from)
    const rm = fs.rm.bind(fs)
    vi.spyOn(fs, 'rm').mockImplementation(async (file, options) => {
      if (String(file) === source) {
        if (removed === 'some') await rm(await storage.resolveInRoot(`${from}/images/frame.bin`))
        if (removed === 'all') await rm(source, { recursive: true })
        throw Object.assign(new Error('source cannot be removed'), { code: 'EACCES' })
      }
      await rm(file, options)
    })
    await expect(storage.move(from, to)).rejects.toMatchObject({ code: 'STORAGE_FAILED' })
    expect(await fingerprint(storage, from)).toBe(original)
    expect(await storage.directories('trash')).toEqual([])
    expect(await storage.directories('items')).toEqual(['sample'])
  },
)

it('コピー内容が一致しなければ元を削除しない', async () => {
  const copy = fs.copyFile.bind(fs)
  const trashRoot = await storage.resolveInRoot('trash')
  vi.spyOn(fs, 'copyFile').mockImplementation(async (...args: Parameters<typeof fs.copyFile>) => {
    await copy(...args)
    if (String(args[1]).startsWith(trashRoot + path.sep) && String(args[1]).endsWith('frame.bin'))
      await fs.writeFile(args[1], 'corrupted copy')
  })
  await expect(moveByCopy(storage, from, to)).rejects.toMatchObject({ code: 'STORAGE_FAILED' })
  expect(await fingerprint(storage, from)).toBe(original)
  expect(await storage.directories('trash')).toEqual([])
})
