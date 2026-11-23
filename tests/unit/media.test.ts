import { promises as fs } from 'node:fs'
import path from 'node:path'
import { beforeEach, afterEach, expect, it } from 'vitest'
import sharp from 'sharp'
import { StorageService } from '../../src/main/services/StorageService'
import { readMedia } from '../../src/main/services/MediaService'
import { referenceUrl } from '../../src/shared/library/mediaUrl'
let root: string
let storage: StorageService
beforeEach(async () => {
  const parent = path.resolve('work/media-tests')
  await fs.mkdir(parent, { recursive: true })
  root = await fs.mkdtemp(path.join(parent, 'case-'))
  storage = await StorageService.open(root)
})
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true })
})
it.each([
  '../outside.png',
  '%2e%2e%2foutside.png',
  'a/../image.png',
  '%43%3a%5cWindows%5coutside.png',
  '%2foutside.png',
  'a%5c..%5coutside.png',
  'image.svg',
  'settings.json',
  'image.png.exe',
  'image.png?other=1',
])('危険なパス・画像以外を拒否: %s', async (file) => {
  await expect(readMedia(storage, `aya-media://data/${file}`)).rejects.toMatchObject({
    code: 'UNSAFE_PATH',
  })
})
it('別ホスト・別スキーム・書き込みメソッドを拒否する', async () => {
  for (const url of [
    'file:///image.png',
    'aya-media://other/image.png',
    'aya-media://data//image.png',
  ])
    await expect(readMedia(storage, url)).rejects.toMatchObject({ code: 'UNSAFE_PATH' })
  await expect(readMedia(storage, 'aya-media://data/image.png', 'POST')).rejects.toMatchObject({
    code: 'UNSAFE_PATH',
  })
})
it('日本語パスの画像を返し、一覧用には縮小画像を返す', async () => {
  const id = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
  await storage.ensureDirectory(`library/characters/${id}/refs`)
  const relative = `library/characters/${id}/refs/日本語 画像.png`
  const bytes = await sharp({
    create: { width: 640, height: 480, channels: 3, background: 'white' },
  })
    .png()
    .toBuffer()
  await fs.writeFile(await storage.resolveInRoot(relative), bytes)
  expect((await readMedia(storage, referenceUrl(id, 'refs/日本語 画像.png'))).bytes).toEqual(bytes)
  const thumb = await readMedia(storage, referenceUrl(id, 'refs/日本語 画像.png', true))
  expect(thumb.mime).toBe('image/webp')
  expect((await sharp(thumb.bytes).metadata()).width).toBe(240)
})
it('pngの拡張子でも画像以外の内容は返さない', async () => {
  await fs.writeFile(await storage.resolveInRoot('fake.png'), '{}')
  await expect(readMedia(storage, 'aya-media://data/fake.png')).rejects.toMatchObject({
    code: 'IMAGE_INVALID',
  })
})
