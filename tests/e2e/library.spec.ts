import { expect, test } from '@playwright/test'
import { launch, testRoot } from './helpers'

test('キャラと固定プロンプトの第2版が再起動後も残る', async () => {
  const root = await testRoot()
  const app = await launch(root)
  try {
    const page = await app.firstWindow()
    await page.getByRole('button', { name: 'キャラ', exact: true }).click()
    await page.getByRole('button', { name: 'キャラを追加' }).click()
    await page.getByLabel('名前', { exact: true }).fill('検証用キャラ')
    await page.getByLabel('顔 英語', { exact: true }).fill('Rounded face')
    await page.getByLabel('顔 日本語', { exact: true }).fill('丸い顔')
    await page.getByRole('button', { name: '衣装を追加' }).click()
    await page.getByLabel('衣装の名前').fill('外出着')
    await page.getByLabel('靴 英語', { exact: true }).fill('Black sneakers')
    await page.getByLabel('靴 日本語', { exact: true }).fill('黒いスニーカー')
    await page.getByRole('button', { name: '固定する' }).click()
    await expect(page.getByRole('button', { name: '固定を解除' })).toBeVisible()

    await page.getByRole('button', { name: 'プロンプト', exact: true }).click()
    await page.getByLabel('素材の役割 英語', { exact: true }).fill('Use the 3D character image.')
    await page.getByLabel('変更メモ').fill('再起動の確認')
    await page.getByRole('button', { name: 'この版で保存' }).click()
    await expect(page.getByRole('heading', { name: '版数 2' })).toBeVisible()
  } finally {
    await app.close()
  }

  const restarted = await launch(root)
  try {
    const page = await restarted.firstWindow()
    await page.getByRole('button', { name: 'キャラ', exact: true }).click()
    await page.getByRole('button', { name: '検証用キャラ（固定中）' }).click()
    await expect(page.getByLabel('顔 英語', { exact: true })).toHaveValue('Rounded face')
    await expect(page.getByLabel('顔 日本語', { exact: true })).toHaveValue('丸い顔')
    await expect(page.getByLabel('衣装の名前')).toHaveValue('外出着')
    await expect(page.getByLabel('靴 英語', { exact: true })).toHaveValue('Black sneakers')
    await expect(page.getByRole('button', { name: '固定を解除' })).toBeVisible()

    await page.getByRole('button', { name: 'プロンプト', exact: true }).click()
    await expect(page.getByRole('heading', { name: '版数 2' })).toBeVisible()
    await expect(page.getByLabel('素材の役割 英語', { exact: true })).toHaveValue(
      'Use the 3D character image.',
    )
    await page.getByRole('button', { name: /版 1/ }).click()
    await expect(page.getByLabel('素材の役割 英語', { exact: true })).not.toBeEditable()
    await expect(page.getByLabel('素材の役割 英語', { exact: true })).toHaveValue(/main reference/)
  } finally {
    await restarted.close()
  }
})
