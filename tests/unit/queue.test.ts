import { expect, it } from 'vitest'
import { OperationQueue } from '../../src/main/services/OperationQueue'

it('保存・保存先変更などの操作は重ならず、1件の失敗後も後続を実行する', async () => {
  const queue = new OperationQueue()
  const actions: string[] = []
  let release: (() => void) | undefined
  const writing = queue.run(async () => {
    actions.push('保存開始')
    await new Promise<void>((resolve) => {
      release = resolve
    })
    actions.push('保存終了')
  })
  const failed = queue.run(async () => {
    actions.push('変更失敗')
    throw new Error('cannot change root')
  })
  const rejected = expect(failed).rejects.toThrow('cannot change root')
  const reading = queue.run(async () => {
    actions.push('一覧取得')
  })
  await Promise.resolve()
  expect(actions).toEqual(['保存開始'])
  release?.()
  await writing
  await rejected
  await reading
  expect(actions).toEqual(['保存開始', '保存終了', '変更失敗', '一覧取得'])
})
