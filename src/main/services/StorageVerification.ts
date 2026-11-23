import { createReadStream, promises as fs } from 'node:fs'
import { createHash } from 'node:crypto'
import { AppError } from '../../shared/errors'
import type { StorageService } from './StorageService'

// Include empty directories, file sizes and complete streamed content hashes.
export async function fingerprint(
  storage: Pick<StorageService, 'resolveInRoot'>,
  relative: string,
): Promise<string> {
  const entries: string[] = []
  async function visit(current: string, key: string): Promise<void> {
    const file = await storage.resolveInRoot(current)
    const stat = await fs.lstat(file)
    if (stat.isDirectory()) {
      entries.push(`directory:${key}`)
      for (const name of (await fs.readdir(file)).sort())
        await visit(`${current}/${name}`, `${key}/${name}`)
    } else if (stat.isFile()) {
      const hash = createHash('sha256')
      for await (const chunk of createReadStream(file)) hash.update(chunk)
      entries.push(`file:${key}:${stat.size}:${hash.digest('hex')}`)
    } else throw new AppError('UNSAFE_PATH')
  }
  await visit(relative, '')
  return JSON.stringify(entries)
}
