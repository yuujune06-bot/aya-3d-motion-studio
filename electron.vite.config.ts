import { resolve } from 'node:path'
import { randomBytes } from 'node:crypto'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const nonce = randomBytes(16).toString('base64')

export default defineConfig({
  main: {},
  preload: {
    build: {
      rollupOptions: {
        output: { format: 'cjs', entryFileNames: 'index.cjs' },
      },
    },
  },
  renderer: {
    html: { cspNonce: nonce },
    resolve: { alias: { '@': resolve('src/renderer') } },
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'aya-csp-nonce',
        transformIndexHtml: {
          order: 'post',
          handler: (html) => html.replaceAll('__CSP_NONCE__', nonce),
        },
      },
    ],
  },
})
