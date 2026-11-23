import { createStore } from 'zustand/vanilla'
import type { AppApi, SettingsInfo } from '../../shared/api'
import { type ApiResult, type ErrorCode } from '../../shared/errors'

class RequestError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message)
  }
}
async function unwrap<T>(response: Promise<ApiResult<T>>): Promise<T> {
  const result = await response
  if (!result.ok) throw new RequestError(result.code, result.detail)
  return result.data
}
type Screen = 'home' | 'settings'

export interface EditorState {
  screen: Screen
  settings: SettingsInfo | null
  busy: boolean
  closing: boolean
  closeConfirmation: boolean
  error: { code: ErrorCode; detail: string } | null
  init: () => Promise<void>
  navigate: (screen: Screen) => void
  changeRoot: () => Promise<void>
  openRoot: () => Promise<void>
  close: () => Promise<void>
  retryClose: () => Promise<void>
  cancelClose: () => void
  clearError: () => void
}

export function createEditorStore(api: AppApi) {
  return createStore<EditorState>()((set, get) => {
    const report = (error: unknown): void => {
      set({
        error: {
          code: error instanceof RequestError ? error.code : 'STORAGE_FAILED',
          detail: error instanceof Error ? error.message : String(error),
        },
      })
    }
    const run = async (operation: () => Promise<void>): Promise<void> => {
      if (get().busy || get().closing) return
      set({ busy: true, error: null })
      try {
        await operation()
      } catch (error) {
        report(error)
      } finally {
        set({ busy: false })
      }
    }
    return {
      screen: 'home',
      settings: null,
      busy: false,
      closing: false,
      closeConfirmation: false,
      error: null,
      init: () => run(async () => set({ settings: await unwrap(api.settings.get()) })),
      navigate: (screen) => set({ screen }),
      changeRoot: () =>
        run(async () => {
          const settings = await unwrap(api.settings.selectRoot())
          if (settings) set({ settings })
        }),
      openRoot: () =>
        run(async () => {
          await unwrap(api.settings.openRoot())
        }),
      close: async () => {
        if (get().closing) return
        set({ closing: true })
        try {
          await unwrap(api.finishClose())
        } catch (error) {
          report(error)
          try {
            await unwrap(api.cancelClose())
          } catch (cancelError) {
            report(cancelError)
          }
          set({ closeConfirmation: true })
        }
      },
      retryClose: async () => {
        try {
          await unwrap(api.finishClose())
          set({ closeConfirmation: false })
        } catch (error) {
          report(error)
        }
      },
      cancelClose: () => {
        set({ closeConfirmation: false, closing: false })
      },
      clearError: () => set({ error: null }),
    }
  })
}
