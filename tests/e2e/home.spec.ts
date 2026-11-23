import { expect, test } from '@playwright/test'
import { launch, testRoot } from './helpers'

test('起動すると日本語のホームが表示され、安全なpreloadでpingが往復する', async () => {
  const app = await launch(await testRoot())
  try {
    const page = await app.firstWindow()
    await expect(page.getByRole('heading', { name: 'まだ制作がありません' })).toBeVisible()
    await expect(page.getByRole('button', { name: '＋ 新しい制作を作る' })).toBeVisible()
    await expect(page.evaluate(() => window.api.ping())).resolves.toBe('pong')
    expect(await page.evaluate(() => Object.keys(window.api).sort())).toEqual([
      'cancelClose',
      'finishClose',
      'onBeforeClose',
      'ping',
      'settings',
    ])
    expect(await page.evaluate(() => typeof Reflect.get(window, 'require'))).toBe('undefined')
  } finally {
    await app.close()
  }
})
