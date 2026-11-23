import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { PING_CHANNEL, type AppApi } from '../shared/api'

const api: AppApi = {
  ping: () => ipcRenderer.invoke(PING_CHANNEL) as Promise<'pong'>,
  library: {
    list: () => ipcRenderer.invoke('library:list'),
    getCharacter: (id) => ipcRenderer.invoke('character:get', id),
    createCharacter: (name) => ipcRenderer.invoke('character:create', name),
    saveCharacter: (value, options) => ipcRenderer.invoke('character:save', value, options),
    trashCharacter: (id, options) => ipcRenderer.invoke('character:trash', id, options),
    usage: (id, kind) => ipcRenderer.invoke('library:usage', id, kind),
    getStyle: (id) => ipcRenderer.invoke('style:get', id),
    createStyle: (name) => ipcRenderer.invoke('style:create', name),
    saveStyle: (value) => ipcRenderer.invoke('style:save', value),
    trashStyle: (id) => ipcRenderer.invoke('style:trash', id),
    addReference: (id, options, file) =>
      ipcRenderer.invoke('reference:add', id, options, file ? webUtils.getPathForFile(file) : null),
    removeReference: (id, refId, options) =>
      ipcRenderer.invoke('reference:remove', id, refId, options),
  },
  projects: {
    readScript: () => ipcRenderer.invoke('project:read-script'),
    list: () => ipcRenderer.invoke('project:list'),
    create: (title) => ipcRenderer.invoke('project:create', title),
    get: (id) => ipcRenderer.invoke('project:get', id),
    save: (project) => ipcRenderer.invoke('project:save', project),
    rename: (id, title) => ipcRenderer.invoke('project:rename', id, title),
    duplicate: (id) => ipcRenderer.invoke('project:duplicate', id),
    moveToTrash: (id) => ipcRenderer.invoke('project:trash', id),
    restore: (id) => ipcRenderer.invoke('project:restore', id),
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
