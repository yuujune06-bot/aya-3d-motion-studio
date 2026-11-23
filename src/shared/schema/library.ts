import { z } from 'zod'

export const idSchema = z.string().regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/)
const timestamp = z.iso.datetime()
export const bilingualSchema = z.object({ en: z.string(), ja: z.string() })
export type Bilingual = z.infer<typeof bilingualSchema>
const appearance = z.object({
  style: bilingualSchema,
  face: bilingualSchema,
  hair: bilingualSchema,
  body: bilingualSchema,
  notes: bilingualSchema,
})
const outfit = z.object({
  id: idSchema,
  name: z.string(),
  top: bilingualSchema,
  bottom: bilingualSchema,
  shoes: bilingualSchema,
  isDefault: z.boolean(),
})
const unique = (values: readonly unknown[]): boolean => new Set(values).size === values.length
export const characterEditSchema = z.object({
  name: z.string(),
  locked: z.boolean(),
  appearance,
  outfits: z
    .array(outfit)
    .refine(
      (items) =>
        unique(items.map((item) => item.id)) &&
        items.filter((item) => item.isDefault).length === Math.min(1, items.length),
    ),
})
const image = z
  .object({
    id: idSchema,
    file: z.string(),
    note: z.string(),
    isPrimary: z.boolean(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })
  .refine((item) => new RegExp('^images/' + item.id + '\\.(png|jpg|jpeg|webp)$').test(item.file))
export const characterSchema = characterEditSchema.extend({
  schemaVersion: z.literal(1),
  id: idSchema,
  revision: z.number().int().positive(),
  images: z
    .array(image)
    .refine(
      (items) =>
        unique(items.map((item) => item.id)) &&
        items.filter((item) => item.isPrimary).length === Math.min(1, items.length),
    ),
  createdAt: timestamp,
  updatedAt: timestamp,
})
export type Character = z.infer<typeof characterSchema>
export type CharacterEdit = z.infer<typeof characterEditSchema>
export interface CharacterList {
  characters: Character[]
  unreadable: string[]
}

const block = z.object({ id: z.string().min(1), title: z.string(), text: bilingualSchema })
export const fixedPromptEditSchema = z.object({
  blocks: z
    .array(block)
    .min(1)
    .refine((items) => unique(items.map((item) => item.id))),
  note: z.string(),
})
const version = fixedPromptEditSchema.extend({
  version: z.number().int().positive(),
  createdAt: timestamp,
})
export const fixedPromptSchema = z
  .object({
    schemaVersion: z.literal(1),
    current: z.number().int().positive(),
    versions: z.array(version),
  })
  .refine(
    (data) =>
      unique(data.versions.map((item) => item.version)) &&
      data.versions.some((item) => item.version === data.current),
  )
export type FixedPromptTemplate = z.infer<typeof fixedPromptSchema>
export type FixedPromptEdit = z.infer<typeof fixedPromptEditSchema>

export const categorySchema = z.enum([
  'motion',
  'hands',
  'expression',
  'gaze',
  'eyes',
  'brows',
  'mouth',
  'head',
  'location',
  'lighting',
  'props',
  'camera',
  'avoid',
])
export const phraseEditSchema = z.object({
  category: categorySchema,
  label: z.string().trim().min(1),
  text: bilingualSchema,
  tags: z.array(z.enum(['contact', 'needs-full-body'])).optional(),
})
export const phraseSchema = phraseEditSchema.extend({
  id: z.string().min(1),
  builtIn: z.boolean(),
  hidden: z.boolean().optional(),
})
export const userPhraseId = z.templateLiteral(['user.', idSchema])
export const defaultPhrasesSchema = z.object({
  schemaVersion: z.literal(1),
  phrases: z
    .array(phraseSchema.omit({ builtIn: true, hidden: true }))
    .length(82)
    .refine(
      (items) =>
        unique(items.map((item) => item.id)) &&
        items.every((item) => item.id.startsWith(item.category + '.')) &&
        categorySchema.options.every((category) => {
          const count = items.filter((item) => item.category === category).length
          return count >= 3 && count <= 12
        }),
    ),
})
export const phraseLibrarySchema = z.object({
  schemaVersion: z.literal(1),
  users: z
    .array(
      phraseSchema.omit({ hidden: true }).extend({
        id: userPhraseId,
        builtIn: z.literal(false),
      }),
    )
    .refine((items) => unique(items.map((item) => item.id))),
  hidden: z.array(z.string()),
})
export type Phrase = z.infer<typeof phraseSchema>
export type PhraseEdit = z.infer<typeof phraseEditSchema>
