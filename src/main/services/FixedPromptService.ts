import initial from '../../../resources/fixed-prompt.default.json'
import {
  fixedPromptSchema,
  fixedPromptEditSchema,
  type FixedPromptEdit,
  type FixedPromptTemplate,
} from '../../shared/schema/library'
import type { StorageService } from './StorageService'

const file = 'library/templates/fixed-prompt.json'
export class FixedPromptService {
  constructor(private storage: StorageService) {}

  async get(): Promise<FixedPromptTemplate> {
    if (await this.storage.exists(file)) return this.storage.readJson(file, fixedPromptSchema)
    const template = fixedPromptSchema.parse(initial)
    await this.storage.writeJsonAtomic(file, template)
    return template
  }

  async save(edit: FixedPromptEdit): Promise<FixedPromptTemplate> {
    const template = await this.get()
    const version = Math.max(...template.versions.map((item) => item.version)) + 1
    const next: FixedPromptTemplate = {
      ...template,
      current: version,
      versions: [
        ...template.versions,
        { ...fixedPromptEditSchema.parse(edit), version, createdAt: new Date().toISOString() },
      ],
    }
    await this.storage.writeJsonAtomic(file, next)
    return next
  }
}
