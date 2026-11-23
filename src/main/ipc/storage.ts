import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { z } from 'zod'
import { AppError, type ApiResult } from '../../shared/errors'
import { idSchema, projectSchema, titleSchema } from '../../shared/schema/project'
import { OperationQueue } from '../services/OperationQueue'
import { ProjectService } from '../services/ProjectService'
import type { SettingsService } from '../services/SettingsService'
import { readScriptFile } from '../services/ScriptService'
import { registerLibraryHandlers } from './library'

export function registerStorageHandlers(settings: SettingsService): {
  authorizeClose: (window: BrowserWindow) => void
} {
  const queue = new OperationQueue()
  const closable = new WeakSet<BrowserWindow>()
  const deadlines = new WeakMap<BrowserWindow, ReturnType<typeof setTimeout>>()
  const cancelDeadline = (window: BrowserWindow): void => {
    clearTimeout(deadlines.get(window))
    deadlines.delete(window)
  }
  const projects = (): ProjectService => new ProjectService(settings.data)

  function handle<T extends unknown[], R>(
    channel: string,
    schema: z.ZodType<T>,
    action: (window: BrowserWindow, ...args: T) => Promise<R>,
    queued = true,
  ): void {
    ipcMain.handle(channel, async (event, ...args: unknown[]): Promise<ApiResult<R>> => {
      try {
        const window = BrowserWindow.fromWebContents(event.sender)
        if (!window || event.senderFrame !== event.sender.mainFrame)
          throw new AppError('INVALID_INPUT')
        const parsed = schema.parse(args)
        const data = await (queued
          ? queue.run(() => action(window, ...parsed))
          : action(window, ...parsed))
        return { ok: true, data }
      } catch (error) {
        console.error(channel, error)
        return {
          ok: false,
          code:
            error instanceof AppError
              ? error.code
              : error instanceof z.ZodError
                ? 'INVALID_INPUT'
                : 'STORAGE_FAILED',
          detail: error instanceof Error ? error.message : String(error),
        }
      }
    })
  }
  registerLibraryHandlers(handle, settings)
  handle('project:list', z.tuple([]), async () => projects().list())
  handle('project:read-script', z.tuple([]), async (window) => {
    const selection = await dialog.showOpenDialog(window, {
      title: '台本を読み込む',
      filters: [{ name: '台本（UTF-8）', extensions: ['txt', 'md'] }],
      properties: ['openFile'],
    })
    if (selection.canceled || !selection.filePaths[0]) return null
    return readScriptFile(selection.filePaths[0])
  })
  handle('project:create', z.tuple([titleSchema]), async (_window, title) =>
    projects().create(title),
  )
  handle('project:get', z.tuple([idSchema]), async (_window, id) => projects().get(id))
  handle('project:save', z.tuple([projectSchema]), async (_window, project) =>
    projects().save(project),
  )
  handle('project:rename', z.tuple([idSchema, titleSchema]), async (_window, id, title) =>
    projects().rename(id, title),
  )
  handle('project:duplicate', z.tuple([idSchema]), async (_window, id) => projects().duplicate(id))
  handle('project:trash', z.tuple([idSchema]), async (_window, id) => projects().moveToTrash(id))
  handle('project:restore', z.tuple([idSchema]), async (_window, id) => projects().restore(id))
  handle('settings:get', z.tuple([]), async () => settings.getInfo())
  handle('settings:select-root', z.tuple([]), async (window) => {
    const selection = await dialog.showOpenDialog(window, {
      title: '新しいデータ保存先を選ぶ',
      defaultPath: settings.get().dataRoot,
      properties: ['openDirectory', 'createDirectory'],
    })
    if (selection.canceled || !selection.filePaths[0]) return null
    return settings.changeRoot(selection.filePaths[0])
  })
  handle('settings:open-root', z.tuple([]), async () => {
    const error = await shell.openPath(settings.data.root)
    if (error) throw new AppError('STORAGE_FAILED', { cause: error })
  })
  handle(
    'app:finish-close',
    z.tuple([]),
    async (window) => {
      cancelDeadline(window)
      closable.add(window)
      // Avoid destroying the IPC sender until its invoke promise has resolved.
      setTimeout(() => window.close(), 0)
    },
    false,
  )
  handle('app:cancel-close', z.tuple([]), async (window) => cancelDeadline(window), false)
  return {
    authorizeClose: (window) => {
      window.on('close', (event) => {
        if (closable.has(window)) return
        event.preventDefault()
        if (deadlines.has(window)) return
        deadlines.set(
          window,
          setTimeout(() => {
            deadlines.delete(window)
            window.destroy()
          }, 5000),
        )
        window.webContents.send('app:before-close')
      })
      window.once('closed', () => cancelDeadline(window))
    },
  }
}
