import { afterEach, expect, it, vi } from 'vitest'
import { Autosave } from '../../src/renderer/stores/autosave'

afterEach(() => {
  vi.useRealTimers()
})
it('500msの間は保存せず、最後の変更のみ保存する', async () => {
  vi.useFakeTimers()
  const save = vi.fn(async (value: string) => {
    void value
  })
  const autosave = new Autosave(save)
  autosave.schedule('最初')
  await vi.advanceTimersByTimeAsync(400)
  autosave.schedule('最後')
  await vi.advanceTimersByTimeAsync(499)
  expect(save).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1)
  expect(save).toHaveBeenCalledExactlyOnceWith('最後')
})
it('終了時のflushは待機中の変更をすぐ保存し、保存中の変更も待つ', async () => {
  let complete: (() => void) | undefined
  const saved: string[] = []
  const autosave = new Autosave(async (value: string) => {
    if (value === 'A')
      await new Promise<void>((resolve) => {
        complete = resolve
      })
    saved.push(value)
  })
  autosave.schedule('A')
  const flushing = autosave.flush()
  autosave.schedule('B')
  complete?.()
  await flushing
  expect(saved).toEqual(['A', 'B'])
})
it('失敗した保存内容を保持し、再試行できる', async () => {
  const save = vi.fn().mockRejectedValueOnce(new Error('disk full')).mockResolvedValue(undefined)
  const autosave = new Autosave<string>(save)
  autosave.schedule('変更')
  await expect(autosave.flush()).rejects.toThrow('disk full')
  await autosave.flush()
  expect(save).toHaveBeenCalledTimes(2)
})
