import { contextBridge, ipcRenderer } from 'electron'
import { PING_CHANNEL, type AppApi } from '../shared/api'

const api: AppApi = {
  ping: () => ipcRenderer.invoke(PING_CHANNEL) as Promise<'pong'>,
  characters: {
    list: () => ipcRenderer.invoke('characters:list'),
    get: (id) => ipcRenderer.invoke('characters:get', id),
    create: () => ipcRenderer.invoke('characters:create'),
    save: (id, edit, options) => ipcRenderer.invoke('characters:save', id, edit, options),
    remove: (id, options) => ipcRenderer.invoke('characters:remove', id, options),
    addImage: (id, options) => ipcRenderer.invoke('characters:add-image', id, options),
    primaryImage: (id, image, options) =>
      ipcRenderer.invoke('characters:primary-image', id, image, options),
    removeImage: (id, image, options) =>
      ipcRenderer.invoke('characters:remove-image', id, image, options),
  },
  fixedPrompt: {
    get: () => ipcRenderer.invoke('fixed-prompt:get'),
    save: (edit) => ipcRenderer.invoke('fixed-prompt:save', edit),
  },
  phrases: {
    list: () => ipcRenderer.invoke('phrases:list'),
    save: (id, edit) => ipcRenderer.invoke('phrases:save', id, edit),
    remove: (id) => ipcRenderer.invoke('phrases:remove', id),
    setHidden: (id, hidden) => ipcRenderer.invoke('phrases:set-hidden', id, hidden),
  },
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
