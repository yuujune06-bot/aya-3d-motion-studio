import { app, BrowserWindow, dialog, protocol } from 'electron'
import { join } from 'node:path'
import { registerPingHandler } from './ipc/ping'
import { registerStorageHandlers } from './ipc/storage'
import { SettingsService } from './services/SettingsService'
import { errorMessages } from '../shared/errors'
import { readMedia } from './services/MediaService'

protocol.registerSchemesAsPrivileged([
  { scheme: 'aya-media', privileges: { standard: true, secure: true } },
])

function createWindow(authorizeClose: (window: BrowserWindow) => void): void {
  const window = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 640,
    minHeight: 480,
    title: 'AYA Reel Editor',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  authorizeClose(window)

  window.once('ready-to-show', () => window.show())
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => event.preventDefault())

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

const testRoot =
  !app.isPackaged && process.env.NODE_ENV === 'test' ? process.env.AYA_TEST_ROOT : undefined
app.setPath(
  'userData',
  testRoot ? join(testRoot, 'config') : join(app.getPath('appData'), 'AYA Reel Editor'),
)

void app
  .whenReady()
  .then(async () => {
    const settings = await SettingsService.open(
      app.getPath('userData'),
      testRoot ? join(testRoot, 'data') : join(app.getPath('home'), 'AYA Reel Editor'),
    )
    protocol.handle('aya-media', async (request) => {
      try {
        const media = await readMedia(settings.data, request.url, request.method)
        return new Response(new Uint8Array(media.bytes), {
          headers: {
            'Content-Type': media.mime,
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': 'no-store',
          },
        })
      } catch {
        return new Response(null, { status: 404 })
      }
    })
    registerPingHandler()
    const { authorizeClose } = registerStorageHandlers(settings)
    createWindow(authorizeClose)
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow(authorizeClose)
    })
  })
  .catch((error: unknown) => {
    console.error(error)
    dialog.showErrorBox('保存場所を開けません', errorMessages.STORAGE_FAILED)
    app.exit(1)
  })

app.on('window-all-closed', () => app.quit())
