import { z } from 'zod'

export const settingsSchema = z
  .object({
    schemaVersion: z.literal(1),
    dataRoot: z.string().min(1),
    ffmpegPath: z.string().optional(),
    ffprobePath: z.string().optional(),
    defaults: z.object({
      charsPerSec: z.number().positive(),
      minSceneSec: z.number().positive(),
      maxSceneSec: z.number().positive(),
      maxReelSec: z.number().positive(),
    }),
  })
  .strict()
export type Settings = z.infer<typeof settingsSchema>
