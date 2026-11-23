import type { ApiResult } from './errors'
import type { Project } from './schema/project'
import type { Settings } from './schema/settings'
import type { Library, LibraryUsage, Character, StylePreset, UnlockOptions } from './schema/library'

export const PING_CHANNEL = 'app:ping'

export interface ProjectList {
  projects: Project[]
  broken: { id: string; hasBackup: boolean }[]
}
export type SettingsInfo = Settings & { resetToDefaults?: boolean; inOneDrive?: boolean }

export interface AppApi {
  ping: () => Promise<'pong'>
  library: {
    list: () => Promise<ApiResult<Library>>
    getCharacter: (id: string) => Promise<ApiResult<Character>>
    createCharacter: (name: string) => Promise<ApiResult<Character>>
    saveCharacter: (value: Character, options: UnlockOptions) => Promise<ApiResult<Character>>
    trashCharacter: (id: string, options: UnlockOptions) => Promise<ApiResult<void>>
    usage: (id: string, kind: 'character' | 'style') => Promise<ApiResult<LibraryUsage>>
    getStyle: (id: string) => Promise<ApiResult<StylePreset>>
    createStyle: (name: string) => Promise<ApiResult<StylePreset>>
    saveStyle: (value: StylePreset) => Promise<ApiResult<StylePreset>>
    trashStyle: (id: string) => Promise<ApiResult<void>>
    addReference: (
      id: string,
      options: UnlockOptions,
      file?: File,
    ) => Promise<ApiResult<Character | null>>
    removeReference: (
      id: string,
      refId: string,
      options: UnlockOptions,
    ) => Promise<ApiResult<Character>>
  }
  projects: {
    readScript: () => Promise<ApiResult<string | null>>
    list: () => Promise<ApiResult<ProjectList>>
    create: (title: string) => Promise<ApiResult<Project>>
    get: (id: string) => Promise<ApiResult<Project>>
    save: (project: Project) => Promise<ApiResult<Project>>
    rename: (id: string, title: string) => Promise<ApiResult<Project>>
    duplicate: (id: string) => Promise<ApiResult<Project>>
    moveToTrash: (id: string) => Promise<ApiResult<void>>
    restore: (id: string) => Promise<ApiResult<Project>>
  }
  settings: {
    get: () => Promise<ApiResult<SettingsInfo>>
    selectRoot: () => Promise<ApiResult<SettingsInfo | null>>
    openRoot: () => Promise<ApiResult<void>>
  }
  onBeforeClose: (callback: () => void) => () => void
  finishClose: () => Promise<ApiResult<void>>
  cancelClose: () => Promise<ApiResult<void>>
}
