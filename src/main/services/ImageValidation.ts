import sharp from 'sharp'
import { AppError } from '../../shared/errors'

export const imageFormats: Record<string, string> = {
  '.png': 'png',
  '.jpg': 'jpeg',
  '.jpeg': 'jpeg',
  '.webp': 'webp',
}
export async function validateImage(bytes: Buffer, extension: string): Promise<void> {
  try {
    const image = sharp(bytes, { failOn: 'warning', limitInputPixels: 40_000_000 })
    const metadata = await image.metadata()
    if (
      !imageFormats[extension] ||
      metadata.format !== imageFormats[extension] ||
      !metadata.width ||
      !metadata.height
    )
      throw new Error('format')
    await image.raw().toBuffer()
  } catch (error) {
    throw new AppError('IMAGE_INVALID', { cause: error })
  }
}
