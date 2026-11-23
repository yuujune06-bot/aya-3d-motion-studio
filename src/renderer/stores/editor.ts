import { createStore } from 'zustand/vanilla'
import type { AppApi, ProjectList, SettingsInfo } from '../../shared/api'
import { type ApiResult, type ErrorCode } from '../../shared/errors'
import type { Project } from '../../shared/schema/project'
import { Autosave } from './autosave'
import { createSceneActions, type SceneActions } from './sceneEditor'
import { createLibraryController, type LibraryState, type LibraryActions } from './libraryEditor'

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
type Screen = 'home' | 'settings' | 'project' | 'library'
export interface EditorState extends SceneActions, LibraryState, LibraryActions {
  screen: Screen
  projects: Project[]
  broken: ProjectList['broken']
  project: Project | null
  settings: SettingsInfo | null
  step: number
  busy: boolean
  closing: boolean
  closeConfirmation: boolean
  status: 'saved' | 'pending' | 'saving' | 'error'
  savedAt: string | null
  error: { code: ErrorCode; detail: string } | null
  undo: {
    projectId: string
    scenes: Project['scenes']
    images: Project['images']
    expiresAt: number
  } | null
  init: () => Promise<void>
  navigate: (screen: Screen) => Promise<void>
  open: (id: string) => Promise<void>
  create: (title: string) => Promise<void>
  manage: (kind: 'rename' | 'duplicate' | 'trash', id: string, title?: string) => Promise<void>
  setTitle: (title: string) => void
  setStep: (step: number) => void
  changeRoot: () => Promise<void>
  openRoot: () => Promise<void>
  flush: () => Promise<void>
  close: () => Promise<void>
  discardClose: () => Promise<void>
  cancelClose: () => Promise<void>
  restore: (id: string) => Promise<void>
  clearError: () => void
  readScript: () => Promise<void>
  selectLibrary: (stylePresetId: string | undefined, castIds: string[]) => void
}

export function createEditorStore(api: AppApi) {
  return createStore<EditorState>()((set, get) => {
    let undoTimer: ReturnType<typeof setTimeout> | undefined
    const clearUndo = (): void => {
      clearTimeout(undoTimer)
      set({ undo: null })
    }
    const report = (error: unknown): void => {
      set({
        error: {
          code: error instanceof RequestError ? error.code : 'STORAGE_FAILED',
          detail: error instanceof Error ? error.message : String(error),
        },
      })
    }
    const autosave = new Autosave<Project>(async (snapshot) => {
      set({ status: 'saving', error: null })
      try {
        const saved = await unwrap(api.projects.save(snapshot))
        const current = get().project
        set({
          project:
            current?.id === saved.id
              ? current === snapshot
                ? saved
                : { ...current, updatedAt: saved.updatedAt }
              : current,
          savedAt: saved.updatedAt,
          status: current === snapshot ? 'saved' : 'pending',
        })
      } catch (error) {
        set({ status: 'error' })
        report(error)
        throw error
      }
    })
    const commit = (project: Project, remember = false): void => {
      const current = get().project
      if (!current || current.id !== project.id || get().closing || current === project) return
      if (remember) {
        clearUndo()
        set({
          undo: {
            projectId: current.id,
            scenes: structuredClone(current.scenes),
            images: structuredClone(current.images),
            expiresAt: Date.now() + 10_000,
          },
        })
        undoTimer = setTimeout(clearUndo, 10_000)
      } else {
        clearUndo()
      }
      set({ project, status: 'pending' })
      autosave.schedule(project)
    }
    let flushLibrary = async (): Promise<void> => undefined
    const flushAll = async (): Promise<void> => {
      await autosave.flush()
      await flushLibrary()
    }
    const run = async (operation: () => Promise<void>): Promise<void> => {
      if (get().busy || get().closing) return
      set({ busy: true, error: null })
      try {
        await flushAll()
        await operation()
      } catch (error) {
        report(error)
      } finally {
        set({ busy: false })
      }
    }
    const library = createLibraryController(api, set, get, run, unwrap, report)
    flushLibrary = library.flush
    const refresh = async (): Promise<void> => {
      set(await unwrap(api.projects.list()))
    }
    return {
      ...createSceneActions(get, commit, clearUndo),
      ...library.actions,
      characters: [],
      styles: [],
      brokenLibrary: [],
      character: null,
      style: null,
      screen: 'home',
      projects: [],
      broken: [],
      project: null,
      settings: null,
      step: 0,
      busy: false,
      closing: false,
      closeConfirmation: false,
      status: 'saved',
      savedAt: null,
      error: null,
      undo: null,
      init: () =>
        run(async () => {
          set({ settings: await unwrap(api.settings.get()) })
          await refresh()
        }),
      navigate: (screen) =>
        run(async () => {
          if (screen === 'home') await refresh()
          if (screen === 'library' || screen === 'project') await library.refresh()
          if (screen === 'project')
            set({ savedAt: get().project?.updatedAt ?? null, status: 'saved' })
          set({ screen })
        }),
      open: (id) =>
        run(async () => {
          const project = await unwrap(api.projects.get(id))
          await library.refresh()
          clearUndo()
          set({ project, screen: 'project', savedAt: project.updatedAt, status: 'saved', step: 0 })
        }),
      create: (title) =>
        run(async () => {
          const project = await unwrap(api.projects.create(title))
          await library.refresh()
          clearUndo()
          set({ project, screen: 'project', savedAt: project.updatedAt, status: 'saved', step: 0 })
        }),
      manage: (kind, id, title) =>
        run(async () => {
          if (kind === 'rename') await unwrap(api.projects.rename(id, title ?? ''))
          else if (kind === 'duplicate') await unwrap(api.projects.duplicate(id))
          else await unwrap(api.projects.moveToTrash(id))
          await refresh()
        }),
      setTitle: (title) => {
        const project = get().project
        if (!project || get().busy || get().closing) return
        const updated = { ...project, title }
        commit(updated)
      },
      setStep: (step) => {
        if (step >= 0 && step < 6) set({ step })
      },
      changeRoot: () =>
        run(async () => {
          const settings = await unwrap(api.settings.selectRoot())
          if (settings) {
            clearUndo()
            set({
              settings,
              project: null,
              savedAt: null,
              characters: [],
              styles: [],
              brokenLibrary: [],
              character: null,
              style: null,
            })
            await refresh()
          }
        }),
      openRoot: () =>
        run(async () => {
          await unwrap(api.settings.openRoot())
        }),
      flush: flushAll,
      close: async () => {
        if (get().closing) return
        set({ closing: true })
        try {
          await flushAll()
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
      discardClose: async () => {
        try {
          await unwrap(api.finishClose())
          set({ closeConfirmation: false })
        } catch (error) {
          report(error)
        }
      },
      cancelClose: async () => {
        set({ closeConfirmation: false, closing: false })
      },
      restore: (id) =>
        run(async () => {
          await unwrap(api.projects.restore(id))
          await refresh()
        }),
      clearError: () => set({ error: null }),
      selectLibrary: (stylePresetId, castIds) => {
        const project = get().project
        if (!project || get().busy || get().closing) return
        commit({ ...project, stylePresetId, castIds })
      },
      readScript: () =>
        run(async () => {
          const text = await unwrap(api.projects.readScript())
          const project = get().project
          if (text !== null && project) commit({ ...project, script: { ...project.script, text } })
        }),
    }
  })
}
