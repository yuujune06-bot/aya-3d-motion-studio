import { promises as fs } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { AppError } from '../../shared/errors'
import type { StorageService } from './StorageService'
import { imageFormats, validateImage } from './ReferenceService'

export async function readMedia(
  storage: StorageService,
  rawUrl: string,
  method = 'GET',
): Promise<{ bytes: Buffer; mime: string }> {
  // Validate before URL parsing: URL normalization would otherwise hide dot segments.
  const match = /^aya-media:\/\/data\/([^?#]+)(\?thumb=1)?$/.exec(rawUrl)
  if (!match || method !== 'GET') throw new AppError('UNSAFE_PATH')
  let relative: string
  try {
    relative = decodeURIComponent(match[1]!)
  } catch {
    throw new AppError('UNSAFE_PATH')
  }
  const file = await storage.resolveInRoot(relative)
  const format = imageFormats[path.extname(relative).toLowerCase()]
  if (!format) throw new AppError('UNSAFE_PATH')
  const bytes = await fs.readFile(file)
  await validateImage(bytes, path.extname(relative).toLowerCase())
  if (match[2])
    return {
      bytes: await sharp(bytes, { limitInputPixels: 40_000_000 })
        .resize(240, 240, { fit: 'inside', withoutEnlargement: true })
        .webp()
        .toBuffer(),
      mime: 'image/webp',
    }
  return { bytes, mime: `image/${format}` }
}
