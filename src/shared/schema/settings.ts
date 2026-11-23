import { z } from 'zod'

export const settingsSchema = z
  .object({
    schemaVersion: z.literal(1),
    dataRoot: z.string().min(1),
  })
  .strict()
export type Settings = z.infer<typeof settingsSchema>
