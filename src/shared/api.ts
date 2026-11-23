import type { ApiResult } from './errors'

import type {
  Character,
  CharacterEdit,
  CharacterList,
  FixedPromptEdit,
  FixedPromptTemplate,
  Phrase,
  PhraseEdit,
} from './schema/library'
import type { Settings } from './schema/settings'

export const PING_CHANNEL = 'app:ping'

export type SettingsInfo = Settings & { resetToDefaults?: boolean; inOneDrive?: boolean }

type Confirmation = { confirmUnlock?: boolean }
export interface AppApi {
  characters: {
    list: () => Promise<ApiResult<CharacterList>>
    get: (id: string) => Promise<ApiResult<Character>>
    create: () => Promise<ApiResult<Character>>
    save: (id: string, edit: CharacterEdit, options: Confirmation) => Promise<ApiResult<Character>>
    remove: (id: string, options: Confirmation) => Promise<ApiResult<void>>
    addImage: (id: string, options: Confirmation) => Promise<ApiResult<Character | null>>
    primaryImage: (
      id: string,
      image: string,
      options: Confirmation,
    ) => Promise<ApiResult<Character>>
    removeImage: (id: string, image: string, options: Confirmation) => Promise<ApiResult<Character>>
  }
  fixedPrompt: {
    get: () => Promise<ApiResult<FixedPromptTemplate>>
    save: (edit: FixedPromptEdit) => Promise<ApiResult<FixedPromptTemplate>>
  }
  phrases: {
    list: () => Promise<ApiResult<Phrase[]>>
    save: (id: string | null, edit: PhraseEdit) => Promise<ApiResult<Phrase>>
    remove: (id: string) => Promise<ApiResult<void>>
    setHidden: (id: string, hidden: boolean) => Promise<ApiResult<void>>
  }
  ping: () => Promise<'pong'>
  settings: {
    get: () => Promise<ApiResult<SettingsInfo>>
    selectRoot: () => Promise<ApiResult<SettingsInfo | null>>
    openRoot: () => Promise<ApiResult<void>>
  }
  onBeforeClose: (callback: () => void) => () => void
  finishClose: () => Promise<ApiResult<void>>
  cancelClose: () => Promise<ApiResult<void>>
}
