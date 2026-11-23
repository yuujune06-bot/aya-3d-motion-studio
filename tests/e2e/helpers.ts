import { _electron as electron } from '@playwright/test'
import { promises as fs } from 'node:fs'
import path from 'node:path'

export async function testRoot(): Promise<string> {
  const parent = path.resolve('work/e2e')
  await fs.mkdir(parent, { recursive: true })
  return fs.mkdtemp(path.join(parent, 'case-'))
}
export async function launch(root: string) {
  const env: Record<string, string> = { NODE_ENV: 'test', AYA_TEST_ROOT: root }
  for (const [key, value] of Object.entries(process.env)) {
    if (
      value !== undefined &&
      !['NODE_ENV', 'AYA_TEST_ROOT', 'ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL'].includes(key)
    )
      env[key] = value
  }
  return electron.launch({ args: [path.resolve('out/main/index.js')], env })
}
