import { promises as fs } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { ulid } from 'ulid'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import initialPrompt from '../../resources/fixed-prompt.default.json'
import initialPhrases from '../../resources/phrases.default.json'
import {
  defaultPhrasesSchema,
  fixedPromptSchema,
  userPhraseId,
} from '../../src/shared/schema/library'
import { CharacterService } from '../../src/main/services/CharacterService'
import { FixedPromptService } from '../../src/main/services/FixedPromptService'
import { PhraseService } from '../../src/main/services/PhraseService'
import { StorageService } from '../../src/main/services/StorageService'

describe('同梱データ', () => {
  it('固定プロンプトの初版には5つのブロックがある', () => {
    const template = fixedPromptSchema.parse(initialPrompt)
    expect(template.current).toBe(1)
    expect(template.versions).toHaveLength(1)
    expect(template.versions[0]?.blocks.map((block) => block.id)).toEqual([
      'F1',
      'F2',
      'F3',
      'F4',
      'F5',
    ])
  })

  it('部品は13分類に82件あり、分類・件数・IDを検証する', () => {
    const data = defaultPhrasesSchema.parse(initialPhrases)
    expect(data.phrases).toHaveLength(82)
    expect(new Set(data.phrases.map((item) => item.category)).size).toBe(13)
    const [first, second, ...rest] = data.phrases
    expect(
      defaultPhrasesSchema.safeParse({ ...data, phrases: [first, first, ...rest] }).success,
    ).toBe(false)
    expect(
      defaultPhrasesSchema.safeParse({
        ...data,
        phrases: [{ ...first, category: 'unknown' }, second, ...rest],
      }).success,
    ).toBe(false)
  })
})

describe('ライブラリの保存', () => {
  let scratch: string
  let storage: StorageService
  beforeEach(async () => {
    const parent = path.resolve('work/library-tests')
    await fs.mkdir(parent, { recursive: true })
    scratch = await fs.mkdtemp(path.join(parent, 'case-'))
    storage = await StorageService.open(path.join(scratch, 'data'))
  })
  afterEach(async () => {
    const relative = path.relative(path.resolve('work/library-tests'), scratch)
    if (!/^case-[a-z0-9]+$/i.test(relative)) throw new Error('Unexpected test directory')
    await fs.rm(scratch, { recursive: true, force: true })
  })

  it('変更時だけ版数が増え、固定中は確認なしの変更と削除を拒否する', async () => {
    const service = new CharacterService(storage)
    const original = await service.create()
    expect(await service.save(original.id, { ...original, ...{ updatedAt: 'ignored' } })).toEqual(
      original,
    )
    const locked = await service.save(original.id, { ...original, locked: true })
    expect(locked.revision).toBe(original.revision + 1)
    await expect(service.save(original.id, { ...locked, locked: false })).rejects.toMatchObject({
      code: 'CHARACTER_LOCKED',
    })
    await expect(service.remove(original.id)).rejects.toMatchObject({ code: 'CHARACTER_LOCKED' })
    const unlocked = await service.save(original.id, { ...locked, locked: false }, true)
    expect(unlocked.revision).toBe(locked.revision + 1)
    await service.remove(original.id)
    expect(await service.list()).toEqual({ characters: [], unreadable: [] })
    expect(await storage.directories('trash')).toHaveLength(1)
  })

  it('読めないキャラがあっても、読めるキャラを返す', async () => {
    const service = new CharacterService(storage)
    const good = await service.create()
    const bad = ulid()
    await storage.writeTextAtomic(`library/characters/${bad}/character.json`, '{')
    expect(await service.list()).toEqual({ characters: [good], unreadable: [bad] })
  })

  it('画像を検証してコピーし、代表を変更し、削除した画像をゴミ箱へ移す', async () => {
    const service = new CharacterService(storage)
    const original = await service.create()
    const source = path.join(scratch, 'source.png')
    await fs.writeFile(source, 'invalid')
    await expect(service.addImage(original.id, source)).rejects.toMatchObject({
      code: 'IMAGE_INVALID',
    })
    expect(await service.get(original.id)).toEqual(original)
    const bytes = await sharp({ create: { width: 8, height: 4, channels: 3, background: '#ccc' } })
      .png()
      .toBuffer()
    await fs.writeFile(source, bytes)
    const first = await service.addImage(original.id, source)
    expect(first.images[0]).toMatchObject({ isPrimary: true, width: 8, height: 4 })
    const image = first.images[0]!
    const destination = `library/characters/${original.id}/${image.file}`
    expect(await fs.readFile(await storage.resolveInRoot(destination))).toEqual(bytes)
    const second = (await service.addImage(original.id, source)).images[1]!
    const updated = await service.primaryImage(original.id, second.id)
    expect(updated.images.map((item) => item.isPrimary)).toEqual([false, true])
    const remaining = await service.removeImage(original.id, second.id)
    expect(remaining.images).toEqual([image])
    const [trashed] = await storage.files('trash')
    expect(await fs.readFile(await storage.resolveInRoot(`trash/${trashed}`))).toEqual(bytes)
    expect(await fs.readFile(source)).toEqual(bytes)
  })

  it('U-06 新しい版を追加しても初版はそのまま残る', async () => {
    const service = new FixedPromptService(storage)
    const initial = await service.get()
    const blocks = initial.versions[0]!.blocks.map((block) => ({
      ...block,
      text: { ...block.text, en: block.text.en + ' Test.' },
    }))
    const saved = await service.save({ blocks, note: '変更メモ' })
    expect(saved.current).toBe(2)
    expect(saved.versions).toHaveLength(2)
    expect(saved.versions[0]).toEqual(initial.versions[0])
    expect(saved.versions[1]).toMatchObject({ blocks, note: '変更メモ', version: 2 })
    expect(await new FixedPromptService(storage).get()).toEqual(saved)
  })

  it('同梱分と利用者の分を合成し、同梱分は表示設定だけを変更する', async () => {
    const service = new PhraseService(storage)
    const defaults = await service.list()
    expect(defaults).toHaveLength(82)
    expect(defaults.every((item) => item.builtIn)).toBe(true)
    const first = defaults[0]!
    const copy = await service.save(null, first)
    expect(userPhraseId.safeParse(copy.id).success).toBe(true)
    expect(copy).toMatchObject({ builtIn: false, text: first.text })
    await service.save(copy.id, { ...copy, label: '翻訳の調整' })
    await service.setHidden(first.id, true)
    const reopened = new PhraseService(storage)
    expect(await reopened.list()).toHaveLength(83)
    expect((await reopened.list())[0]).toEqual({ ...first, hidden: true })
    expect((await reopened.list()).at(-1)?.label).toBe('翻訳の調整')
    await expect(service.remove(first.id)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await expect(service.save(first.id, copy)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await service.setHidden(first.id, false)
    await service.remove(copy.id)
    expect(await service.list()).toEqual(defaults)
  })
})
