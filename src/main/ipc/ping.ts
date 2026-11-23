import { ipcMain } from 'electron'
import { z } from 'zod'
import { PING_CHANNEL } from '../../shared/api'

const pingArguments = z.tuple([])

export function registerPingHandler(): void {
  ipcMain.handle(PING_CHANNEL, (_event, ...args: unknown[]) => {
    pingArguments.parse(args)
    return 'pong' as const
  })
}
