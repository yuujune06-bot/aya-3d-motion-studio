import type { ApiResult } from './errors'
import type { Settings } from './schema/settings'

export const PING_CHANNEL = 'app:ping'

export type SettingsInfo = Settings & { resetToDefaults?: boolean; inOneDrive?: boolean }

export interface AppApi {
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
