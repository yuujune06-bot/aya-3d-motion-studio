import { promises as fs } from 'node:fs'
import path from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { ulid } from 'ulid'
import { AppError } from '../../shared/errors'
import {
  characterEditSchema,
  characterSchema,
  idSchema,
  type Character,
  type CharacterEdit,
  type CharacterList,
} from '../../shared/schema/library'
import { validateImage } from './ImageValidation'
import type { StorageService } from './StorageService'

const root = 'library/characters'
const directory = (id: string): string => `${root}/${idSchema.parse(id)}`
const metadata = (id: string): string => `${directory(id)}/character.json`

export class CharacterService {
  constructor(private storage: StorageService) {}

  async list(): Promise<CharacterList> {
    if (!(await this.storage.exists(root))) return { characters: [], unreadable: [] }
    const characters: Character[] = []
    const unreadable: string[] = []
    for (const id of (await this.storage.directories(root)).sort()) {
      try {
        characters.push(await this.get(id))
      } catch {
        unreadable.push(id)
      }
    }
    return { characters, unreadable }
  }

  async get(id: string): Promise<Character> {
    const character = await this.storage.readJson(metadata(id), characterSchema)
    if (character.id !== id) throw new AppError('INVALID_JSON')
    return character
  }

  async create(): Promise<Character> {
    const now = new Date().toISOString()
    const empty = { en: '', ja: '' }
    const character: Character = {
      schemaVersion: 1,
      id: ulid(),
      name: '新しいキャラ',
      locked: false,
      revision: 1,
      appearance: { style: empty, face: empty, hair: empty, body: empty, notes: empty },
      outfits: [],
      images: [],
      createdAt: now,
      updatedAt: now,
    }
    await this.storage.writeJsonAtomic(metadata(character.id), character)
    return character
  }

  private async editable(id: string, confirmUnlock: boolean): Promise<Character> {
    const character = await this.get(id)
    if (character.locked && !confirmUnlock) throw new AppError('CHARACTER_LOCKED')
    return character
  }

  private async update(previous: Character, next: Character): Promise<Character> {
    if (isDeepStrictEqual(previous, next)) return previous
    const updated = characterSchema.parse({
      ...next,
      revision: previous.revision + 1,
      updatedAt: new Date().toISOString(),
    })
    await this.storage.writeJsonAtomic(metadata(updated.id), updated)
    return updated
  }

  async save(id: string, edit: CharacterEdit, confirmUnlock = false): Promise<Character> {
    const previous = await this.editable(id, confirmUnlock)
    return this.update(previous, { ...previous, ...characterEditSchema.parse(edit) })
  }

  async remove(id: string, confirmUnlock = false): Promise<void> {
    await this.editable(id, confirmUnlock)
    await this.storage.ensureDirectory('trash')
    await this.storage.move(directory(id), `trash/character-${id}-${ulid()}`)
  }

  async addImage(id: string, source: string, confirmUnlock = false): Promise<Character> {
    const previous = await this.editable(id, confirmUnlock)
    const extension = path.extname(source).toLowerCase()
    const bytes = await fs.readFile(source)
    const { width, height } = await validateImage(bytes, extension)
    const imageId = ulid()
    const file = `images/${imageId}${extension}`
    const relative = `${directory(id)}/${file}`
    await this.storage.ensureDirectory(`${directory(id)}/images`)
    const handle = await fs.open(await this.storage.resolveInRoot(relative), 'wx')
    try {
      try {
        await handle.writeFile(bytes)
        await handle.sync()
      } finally {
        await handle.close()
      }
      return await this.update(previous, {
        ...previous,
        images: [
          ...previous.images,
          {
            id: imageId,
            file,
            note: '',
            width,
            height,
            isPrimary: previous.images.length === 0,
          },
        ],
      })
    } catch (error) {
      await this.storage.ensureDirectory('trash')
      await this.storage.move(relative, `trash/image-${ulid()}${extension}`)
      throw error
    }
  }

  async primaryImage(id: string, imageId: string, confirmUnlock = false): Promise<Character> {
    const previous = await this.editable(id, confirmUnlock)
    if (!previous.images.some((image) => image.id === imageId)) throw new AppError('NOT_FOUND')
    return this.update(previous, {
      ...previous,
      images: previous.images.map((image) => ({ ...image, isPrimary: image.id === imageId })),
    })
  }

  async removeImage(id: string, imageId: string, confirmUnlock = false): Promise<Character> {
    const previous = await this.editable(id, confirmUnlock)
    const image = previous.images.find((item) => item.id === imageId)
    if (!image) throw new AppError('NOT_FOUND')
    const images = previous.images.filter((item) => item !== image)
    if (image.isPrimary && images[0]) images[0] = { ...images[0], isPrimary: true }
    const source = `${directory(id)}/${image.file}`
    const destination = `trash/image-${ulid()}${path.extname(image.file)}`
    await this.storage.ensureDirectory('trash')
    await this.storage.move(source, destination)
    try {
      return await this.update(previous, { ...previous, images })
    } catch (error) {
      await this.storage.move(destination, source)
      throw error
    }
  }
}
