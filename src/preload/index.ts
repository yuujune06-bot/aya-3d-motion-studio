import { contextBridge, ipcRenderer } from 'electron'
import { PING_CHANNEL, type AppApi } from '../shared/api'

const api: AppApi = {
  ping: () => ipcRenderer.invoke(PING_CHANNEL) as Promise<'pong'>,
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    selectRoot: () => ipcRenderer.invoke('settings:select-root'),
    openRoot: () => ipcRenderer.invoke('settings:open-root'),
  },
  onBeforeClose: (callback) => {
    const listener = (): void => callback()
    ipcRenderer.on('app:before-close', listener)
    return () => ipcRenderer.removeListener('app:before-close', listener)
  },
  finishClose: () => ipcRenderer.invoke('app:finish-close'),
  cancelClose: () => ipcRenderer.invoke('app:cancel-close'),
}

contextBridge.exposeInMainWorld('api', api)
