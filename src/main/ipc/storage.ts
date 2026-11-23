import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { z } from 'zod'
import { AppError, type ApiResult } from '../../shared/errors'
import { OperationQueue } from '../services/OperationQueue'
import type { SettingsService } from '../services/SettingsService'
import { CharacterService } from '../services/CharacterService'
import { FixedPromptService } from '../services/FixedPromptService'
import { PhraseService } from '../services/PhraseService'
import {
  characterEditSchema,
  fixedPromptEditSchema,
  idSchema,
  phraseEditSchema,
  userPhraseId,
} from '../../shared/schema/library'

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
  const characters = () => new CharacterService(settings.data)
  const fixedPrompt = () => new FixedPromptService(settings.data)
  const phrases = () => new PhraseService(settings.data)
  const confirmation = z.object({ confirmUnlock: z.boolean().optional() })
  handle('characters:list', z.tuple([]), async () => characters().list())
  handle('characters:get', z.tuple([idSchema]), async (_, id) => characters().get(id))
  handle('characters:create', z.tuple([]), async () => characters().create())
  handle(
    'characters:save',
    z.tuple([idSchema, characterEditSchema, confirmation]),
    async (_, id, edit, options) => characters().save(id, edit, options.confirmUnlock),
  )
  handle('characters:remove', z.tuple([idSchema, confirmation]), async (_, id, options) =>
    characters().remove(id, options.confirmUnlock),
  )
  handle('characters:add-image', z.tuple([idSchema, confirmation]), async (window, id, options) => {
    const service = characters()
    const character = await service.get(id)
    if (character.locked && options.confirmUnlock !== true) throw new AppError('CHARACTER_LOCKED')
    const selection = await dialog.showOpenDialog(window, {
      title: 'キャラ画像を選ぶ',
      filters: [{ name: '画像', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      properties: ['openFile'],
    })
    const source = selection.filePaths[0]
    return selection.canceled || !source
      ? null
      : service.addImage(id, source, options.confirmUnlock)
  })
  handle(
    'characters:primary-image',
    z.tuple([idSchema, idSchema, confirmation]),
    async (_, id, image, options) => characters().primaryImage(id, image, options.confirmUnlock),
  )
  handle(
    'characters:remove-image',
    z.tuple([idSchema, idSchema, confirmation]),
    async (_, id, image, options) => characters().removeImage(id, image, options.confirmUnlock),
  )
  handle('fixed-prompt:get', z.tuple([]), async () => fixedPrompt().get())
  handle('fixed-prompt:save', z.tuple([fixedPromptEditSchema]), async (_, edit) =>
    fixedPrompt().save(edit),
  )
  handle('phrases:list', z.tuple([]), async () => phrases().list())
  handle(
    'phrases:save',
    z.tuple([userPhraseId.nullable(), phraseEditSchema]),
    async (_, id, edit) => phrases().save(id, edit),
  )
  handle('phrases:remove', z.tuple([userPhraseId]), async (_, id) => phrases().remove(id))
  handle('phrases:set-hidden', z.tuple([z.string(), z.boolean()]), async (_, id, hidden) =>
    phrases().setHidden(id, hidden),
  )
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
