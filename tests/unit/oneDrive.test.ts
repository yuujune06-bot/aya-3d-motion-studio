import { promises as fs } from 'node:fs'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { isInOneDrive } from '../../src/shared/oneDrive'
import { SettingsService } from '../../src/main/services/SettingsService'

afterEach(() => vi.unstubAllEnvs())
it.each([
  ['C:\\Users\\yuki\\OneDrive', true],
  ['C:\\Users\\yuki\\OneDrive\\ドキュメント\\AYA 3D Motion Studio', true],
  ['c:/users/YUKI/onedrive/AYA 3D Motion Studio', true],
  ['C:\\Users\\yuki\\OneDrive-backup\\AYA 3D Motion Studio', false],
  ['C:\\Users\\yuki\\AYA 3D Motion Studio', false],
  ['D:\\OneDrive\\AYA 3D Motion Studio', false],
] as const)('保存先 %s のOneDrive判定は %s', (target, expected) => {
  expect(isInOneDrive(target, [undefined, 'C:\\Users\\yuki\\OneDrive\\', ''])).toBe(expected)
})
it('複数のOneDrive環境変数とフォルダー境界を扱う', () => {
  expect(
    isInOneDrive('D:\\会社用\\OneDrive - Example\\data', [
      '',
      undefined,
      'D:\\会社用\\OneDrive - Example',
    ]),
  ).toBe(true)
  expect(isInOneDrive('C:\\Users\\yuki\\data', [undefined, '', undefined])).toBe(false)
})

it('新規設定は渡された既定値を使い、既存のOneDrive保存先は変更しない', async () => {
  const parent = path.resolve('work/one-drive-tests')
  await fs.mkdir(parent, { recursive: true })
  const scratch = await fs.mkdtemp(path.join(parent, 'case-'))
  try {
    for (const name of ['OneDrive', 'OneDriveConsumer', 'OneDriveCommercial']) vi.stubEnv(name, '')
    const homeDefault = path.join(scratch, 'user', 'AYA 3D Motion Studio')
    const config = path.join(scratch, 'config')
    const first = await SettingsService.open(config, homeDefault)
    expect(first.get().dataRoot).toBe(await fs.realpath(homeDefault))
    expect(first.getInfo().inOneDrive).toBe(false)
    const cloudRoot = path.join(scratch, 'OneDrive')
    const cloudData = path.join(cloudRoot, 'ドキュメント', 'AYA 3D Motion Studio')
    for (const name of ['OneDrive', 'OneDriveConsumer', 'OneDriveCommercial']) {
      vi.stubEnv(name, cloudRoot)
      expect((await first.changeRoot(cloudData)).inOneDrive).toBe(true)
      vi.stubEnv(name, '')
    }
    vi.stubEnv('OneDriveConsumer', cloudRoot)
    const before = await fs.readFile(path.join(config, 'settings.json'))
    const restarted = await SettingsService.open(config, homeDefault)
    expect(restarted.get().dataRoot).toBe(await fs.realpath(cloudData))
    expect(restarted.getInfo().inOneDrive).toBe(true)
    expect(await fs.readFile(path.join(config, 'settings.json'))).toEqual(before)
    const returned = await restarted.changeRoot(homeDefault)
    expect(returned.inOneDrive).toBe(false)
    expect(
      JSON.parse(await fs.readFile(path.join(config, 'settings.json'), 'utf8')),
    ).not.toHaveProperty('inOneDrive')
  } finally {
    await fs.rm(scratch, { recursive: true, force: true })
  }
})
