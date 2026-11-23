import { constants, promises as fs } from 'node:fs'
import { AppError } from '../../shared/errors'
import { fingerprint } from './StorageVerification'
import type { StorageService } from './StorageService'

async function restoreRemoved(storage: StorageService, from: string, to: string): Promise<void> {
  const source = await storage.resolveInRoot(from)
  if ((await fs.lstat(source)).isDirectory()) {
    await storage.ensureDirectory(to)
    for (const name of await fs.readdir(source))
      await restoreRemoved(storage, `${from}/${name}`, `${to}/${name}`)
  } else if (await storage.exists(to)) {
    // Do not overwrite surviving files: deletion removes entries, not file contents.
    if ((await fingerprint(storage, from)) !== (await fingerprint(storage, to)))
      throw new AppError('STORAGE_FAILED')
  } else await fs.copyFile(source, await storage.resolveInRoot(to), constants.COPYFILE_EXCL)
}

export async function moveByCopy(storage: StorageService, from: string, to: string): Promise<void> {
  const source = await storage.resolveInRoot(from)
  const destination = await storage.resolveInRoot(to)
  const directory = (await fs.lstat(source)).isDirectory()
  const original = await fingerprint(storage, from)
  let ownedDestination = false
  let removalStarted = false
  try {
    // Reserve exclusively, so rollback never removes someone else's destination.
    if (directory) {
      await fs.mkdir(destination)
      ownedDestination = true
    } else {
      const handle = await fs.open(destination, 'wx')
      ownedDestination = true
      await handle.close()
    }
    if (directory) await storage.copyDirectory(from, to)
    else await fs.copyFile(source, destination)
    if (
      (await fingerprint(storage, to)) !== original ||
      (await fingerprint(storage, from)) !== original
    )
      throw new AppError('STORAGE_FAILED')
    removalStarted = true
    await fs.rm(await storage.resolveInRoot(from), { recursive: directory })
  } catch (cause) {
    if (ownedDestination) {
      if (removalStarted) {
        try {
          if ((await fingerprint(storage, to)) !== original) throw new AppError('STORAGE_FAILED')
          await restoreRemoved(storage, to, from)
          if ((await fingerprint(storage, from)) !== original) throw new AppError('STORAGE_FAILED')
        } catch (rollbackError) {
          // Preserve the verified copy if the OS also prevents restoring the source.
          throw new AppError('STORAGE_FAILED', {
            cause: new AggregateError(
              [cause, rollbackError],
              '元の復元に失敗しました。コピー先のデータは残しています。',
            ),
          })
        }
      }
      try {
        await fs.rm(await storage.resolveInRoot(to), { recursive: directory })
      } catch (cleanupError) {
        throw new AppError('STORAGE_FAILED', {
          cause: new AggregateError(
            [cause, cleanupError],
            'コピー先を削除できませんでした。データは残しています。',
          ),
        })
      }
    }
    throw new AppError('STORAGE_FAILED', { cause })
  }
}
