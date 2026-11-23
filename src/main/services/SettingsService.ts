import path from 'node:path'
import { settingsSchema, type Settings } from '../../shared/schema/settings'
import { StorageService } from './StorageService'
import { AppError } from '../../shared/errors'
import { isInOneDrive } from '../../shared/oneDrive'
import type { SettingsInfo } from '../../shared/api'

export class SettingsService {
  private constructor(
    private config: StorageService,
    private settings: Settings,
    public data: StorageService,
    readonly resetToDefaults = false,
  ) {}

  static async open(configRoot: string, defaultRoot: string): Promise<SettingsService> {
    const config = await StorageService.open(configRoot)
    const defaults = (): Settings =>
      settingsSchema.parse({
        schemaVersion: 1,
        dataRoot: defaultRoot,
        defaults: { charsPerSec: 6, minSceneSec: 2, maxSceneSec: 15, maxReelSec: 180 },
      })
    const load = async (file: string): Promise<Settings> => {
      const value = await config.readJson(file, settingsSchema)
      if (!path.isAbsolute(value.dataRoot)) throw new AppError('INVALID_JSON')
      return value
    }
    const hadSettings = await config.exists('settings.json')
    let settings: Settings
    let needsWrite = !hadSettings
    let resetToDefaults = false
    try {
      settings = await load('settings.json')
    } catch {
      if (hadSettings) await config.preserveBroken('settings.json')
      needsWrite = true
      try {
        settings = await load('settings.json.bak')
      } catch {
        resetToDefaults = hadSettings || (await config.exists('settings.json.bak'))
        settings = defaults()
      }
    }
    const data = await StorageService.open(settings.dataRoot)
    await SettingsService.prepare(data)
    if (needsWrite)
      await config.writeJsonAtomic('settings.json', { ...settings, dataRoot: data.root })
    return new SettingsService(config, { ...settings, dataRoot: data.root }, data, resetToDefaults)
  }
  private static async prepare(data: StorageService): Promise<void> {
    await data.ensureDirectory('projects')
    await data.ensureDirectory('trash')
  }
  get(): Settings {
    return structuredClone(this.settings)
  }
  getInfo(): SettingsInfo {
    return {
      ...this.get(),
      resetToDefaults: this.resetToDefaults,
      inOneDrive: isInOneDrive(this.settings.dataRoot, [
        process.env.OneDrive,
        process.env.OneDriveConsumer,
        process.env.OneDriveCommercial,
      ]),
    }
  }

  async changeRoot(selected: string): Promise<SettingsInfo> {
    const data = await StorageService.open(path.resolve(selected))
    await SettingsService.prepare(data)
    const settings = settingsSchema.parse({ ...this.settings, dataRoot: data.root })
    await this.config.writeJsonAtomic('settings.json', settings)
    this.settings = settings
    this.data = data
    return this.getInfo()
  }
}
