import { constants, promises as fs } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { AppError } from '../../shared/errors'
import { moveByCopy } from './StorageMove'

const missing = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === 'ENOENT'

async function retryReplacement(operation: () => Promise<void>): Promise<void> {
  const waits = [50, 100, 200, 400, 800]
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation()
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code ?? ''
      const wait = waits[attempt]
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(code) || wait === undefined) throw error
      await new Promise<void>((resolve) => setTimeout(resolve, wait))
    }
  }
}

export class StorageService {
  private pending = new Map<string, Promise<unknown>>()
  private constructor(readonly root: string) {}

  static async open(root: string): Promise<StorageService> {
    if (!path.isAbsolute(root)) throw new AppError('UNSAFE_PATH')
    await fs.mkdir(root, { recursive: true })
    return StorageService.openExisting(root)
  }
  static async openExisting(root: string): Promise<StorageService> {
    if (!path.isAbsolute(root)) throw new AppError('UNSAFE_PATH')
    if ((await fs.lstat(root)).isSymbolicLink()) throw new AppError('UNSAFE_PATH')
    return new StorageService(await fs.realpath(root))
  }

  async resolveInRoot(relative: string): Promise<string> {
    if (
      (await fs.lstat(this.root)).isSymbolicLink() ||
      (await fs.realpath(this.root)) !== this.root
    )
      throw new AppError('UNSAFE_PATH')
    if (
      path.win32.isAbsolute(relative) ||
      path.posix.isAbsolute(relative) ||
      relative.includes(':') ||
      Array.from(relative).some((character) => character.charCodeAt(0) < 32)
    )
      throw new AppError('UNSAFE_PATH')
    const parts = relative.split(/[\\/]/)
    if (
      parts.some(
        (part) =>
          !part ||
          part === '..' ||
          part === '.' ||
          /[. ]$/.test(part) ||
          /[<>"|?*]/.test(part) ||
          /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(part),
      )
    )
      throw new AppError('UNSAFE_PATH')
    let current = this.root
    for (const part of parts) {
      current = path.join(current, part)
      try {
        if ((await fs.lstat(current)).isSymbolicLink()) throw new AppError('UNSAFE_PATH')
      } catch (error) {
        if (!missing(error)) throw error
      }
    }
    return current
  }

  async exists(relative: string): Promise<boolean> {
    try {
      await fs.access(await this.resolveInRoot(relative))
      return true
    } catch (error) {
      if (missing(error)) return false
      throw error
    }
  }

  async readJson<T>(
    relative: string,
    schema: z.ZodType<T>,
    migrate?: (raw: unknown) => unknown,
  ): Promise<T> {
    const file = await this.resolveInRoot(relative)
    let text: string
    try {
      text = await fs.readFile(file, 'utf8')
    } catch (error) {
      if (missing(error)) throw new AppError('NOT_FOUND', { cause: error })
      throw error
    }
    let raw: unknown
    let migrated: unknown
    let parsed: T
    try {
      raw = JSON.parse(text)
      migrated = migrate ? migrate(raw) : raw
      parsed = schema.parse(migrated)
    } catch (error) {
      throw new AppError('INVALID_JSON', { cause: error })
    }
    if (migrated !== raw) {
      const version = z
        .object({ schemaVersion: z.number().int().nonnegative() })
        .parse(raw).schemaVersion
      const preserved = `${relative}.v${version}.bak`
      if (!(await this.exists(preserved)))
        await fs.copyFile(file, await this.resolveInRoot(preserved), constants.COPYFILE_EXCL)
      await this.writeJsonAtomic(relative, parsed)
    }
    return parsed
  }

  writeJsonAtomic(relative: string, data: unknown): Promise<void> {
    const json = JSON.stringify(data, null, 2) + '\n'
    return this.writeTextAtomic(relative, json)
  }
  async readText(relative: string): Promise<string> {
    return new TextDecoder('utf-8', { fatal: true }).decode(
      await fs.readFile(await this.resolveInRoot(relative)),
    )
  }
  writeTextAtomic(relative: string, text: string): Promise<void> {
    const previous = this.pending.get(relative) ?? Promise.resolve()
    const task = previous.catch(() => undefined).then(() => this.replaceJson(relative, text))
    this.pending.set(relative, task)
    void task
      .finally(() => {
        if (this.pending.get(relative) === task) this.pending.delete(relative)
      })
      .catch(() => undefined)
    return task
  }

  private async replaceJson(relative: string, json: string): Promise<void> {
    const file = await this.resolveInRoot(relative)
    const temporary = await this.resolveInRoot(relative + '.tmp')
    const backup = await this.resolveInRoot(relative + '.bak')
    await fs.mkdir(path.dirname(file), { recursive: true })
    // Never truncate the original. A crash leaves either the old or complete new JSON.
    const handle = await fs.open(temporary, 'w')
    try {
      await handle.writeFile(json, 'utf8')
      await handle.sync()
    } finally {
      await handle.close()
    }
    try {
      if (await this.exists(relative)) {
        const backupTemporary = await this.resolveInRoot(relative + '.bak.tmp')
        await retryReplacement(() => fs.copyFile(file, backupTemporary))
        await retryReplacement(() => fs.rename(backupTemporary, backup))
      }
      await retryReplacement(() => fs.rename(temporary, file))
    } finally {
      await fs.rm(temporary, { force: true })
    }
  }

  async ensureDirectory(relative: string): Promise<void> {
    await fs.mkdir(await this.resolveInRoot(relative), { recursive: true })
  }
  async directories(relative: string): Promise<string[]> {
    const entries = await fs.readdir(await this.resolveInRoot(relative), { withFileTypes: true })
    return entries
      .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
      .map((entry) => entry.name)
  }
  async files(relative: string): Promise<string[]> {
    const entries = await fs.readdir(await this.resolveInRoot(relative), { withFileTypes: true })
    return entries
      .filter((entry) => entry.isFile() && !entry.isSymbolicLink())
      .map((entry) => entry.name)
  }
  async move(from: string, to: string): Promise<void> {
    const source = await this.resolveInRoot(from)
    const destination = await this.resolveInRoot(to)
    if (await this.exists(to)) throw new AppError('STORAGE_FAILED')
    const relative = path.relative(source, destination)
    if (
      !relative ||
      (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))
    )
      throw new AppError('UNSAFE_PATH')
    try {
      await retryReplacement(() => fs.rename(source, destination))
      return
    } catch (error) {
      if (!['EPERM', 'EBUSY', 'EACCES'].includes((error as NodeJS.ErrnoException).code ?? ''))
        throw error
    }
    await moveByCopy(this, from, to)
  }
  async preserveBroken(relative: string): Promise<string | null> {
    if (!(await this.exists(relative))) return null
    const base = `${relative}.broken-${new Date().toISOString().replace(/[:.]/g, '-')}`
    let destination = base
    for (let suffix = 1; await this.exists(destination); suffix++) destination = `${base}-${suffix}`
    await this.move(relative, destination)
    return destination
  }
  async copyDirectory(from: string, to: string, exclude?: RegExp): Promise<void> {
    await this.ensureDirectory(to)
    for (const entry of await fs.readdir(await this.resolveInRoot(from), { withFileTypes: true })) {
      if (exclude?.test(entry.name)) continue
      const source = `${from}/${entry.name}`
      const target = `${to}/${entry.name}`
      if (entry.isSymbolicLink()) throw new AppError('UNSAFE_PATH')
      if (entry.isDirectory()) await this.copyDirectory(source, target)
      else if (entry.isFile())
        await fs.copyFile(await this.resolveInRoot(source), await this.resolveInRoot(target))
      else throw new AppError('UNSAFE_PATH')
    }
  }
  async idle(): Promise<void> {
    await Promise.all([...this.pending.values()])
  }
}
