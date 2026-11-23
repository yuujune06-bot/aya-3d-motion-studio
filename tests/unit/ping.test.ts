import { beforeEach, expect, it, vi } from 'vitest'

const bridge = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, ...args: unknown[]) => unknown>(),
  exposed: {} as Record<string, unknown>,
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (event: unknown, ...args: unknown[]) => unknown) => {
      bridge.handlers.set(channel, handler)
    },
  },
  ipcRenderer: {
    invoke: async (channel: string, ...args: unknown[]) => {
      const handler = bridge.handlers.get(channel)
      if (!handler) throw new Error(`No handler: ${channel}`)
      return handler({}, ...args)
    },
  },
  contextBridge: {
    exposeInMainWorld: (name: string, api: unknown) => {
      bridge.exposed[name] = api
    },
  },
}))

import { registerPingHandler } from '../../src/main/ipc/ping'
import { PING_CHANNEL, type AppApi } from '../../src/shared/api'

beforeEach(() => {
  bridge.handlers.clear()
  bridge.exposed = {}
  vi.resetModules()
})

it('公開APIからmainへpingを送りpongを受け取り、余分な入力は拒否する', async () => {
  registerPingHandler()
  await import('../../src/preload/index')
  const api = bridge.exposed.api as AppApi

  expect(Object.keys(api).sort()).toEqual([
    'cancelClose',
    'characters',
    'finishClose',
    'fixedPrompt',
    'onBeforeClose',
    'phrases',
    'ping',
    'settings',
  ])
  await expect(api.ping()).resolves.toBe('pong')
  const handler = bridge.handlers.get(PING_CHANNEL)
  expect(() => handler?.({}, 'unexpected')).toThrow()
})
