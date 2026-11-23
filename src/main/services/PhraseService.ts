import { ulid } from 'ulid'
import initial from '../../../resources/phrases.default.json'
import { AppError } from '../../shared/errors'
import {
  defaultPhrasesSchema,
  phraseEditSchema,
  phraseLibrarySchema,
  userPhraseId,
  type Phrase,
  type PhraseEdit,
} from '../../shared/schema/library'
import type { StorageService } from './StorageService'

const file = 'library/phrases/phrases.json'
const defaults = defaultPhrasesSchema.parse(initial).phrases

export class PhraseService {
  constructor(private storage: StorageService) {}

  private async read() {
    if (await this.storage.exists(file)) return this.storage.readJson(file, phraseLibrarySchema)
    return phraseLibrarySchema.parse({ schemaVersion: 1, users: [], hidden: [] })
  }

  async list(): Promise<Phrase[]> {
    const { users, hidden } = await this.read()
    return [
      ...defaults.map((item) => ({ ...item, builtIn: true, hidden: hidden.includes(item.id) })),
      ...users,
    ]
  }

  async save(id: string | null, edit: PhraseEdit): Promise<Phrase> {
    const library = await this.read()
    const index = library.users.findIndex((item) => item.id === id)
    if (id !== null && index < 0) throw new AppError('INVALID_INPUT')
    const phrase = {
      ...phraseEditSchema.parse(edit),
      id: userPhraseId.parse(id ?? `user.${ulid()}`),
      builtIn: false as const,
    }
    if (id === null) library.users.push(phrase)
    else library.users[index] = phrase
    await this.storage.writeJsonAtomic(file, library)
    return phrase
  }

  async remove(id: string): Promise<void> {
    const library = await this.read()
    if (!library.users.some((item) => item.id === id)) throw new AppError('INVALID_INPUT')
    library.users = library.users.filter((item) => item.id !== id)
    await this.storage.writeJsonAtomic(file, library)
  }

  async setHidden(id: string, hidden: boolean): Promise<void> {
    if (!defaults.some((item) => item.id === id)) throw new AppError('INVALID_INPUT')
    const library = await this.read()
    const ids = new Set(library.hidden)
    if (hidden) ids.add(id)
    else ids.delete(id)
    library.hidden = [...ids]
    await this.storage.writeJsonAtomic(file, library)
  }
}
