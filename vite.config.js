import { defineConfig } from 'rolldown-vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import { fileURLToPath, URL } from 'node:url'
import { resolveBase, basePathSegmentsCount } from './vite/resolveBase.js'
import dataDirPlugin from './vite/dataDirPlugin.js'
import spaFallback404Plugin from './vite/spaFallback404Plugin.js'

const BASE = resolveBase()
const DATA_DIR = fileURLToPath(new URL('./data', import.meta.url))

export default defineConfig({
  base: BASE,
  plugins: [
    vue(),
    vuetify({ autoImport: true }),
    dataDirPlugin({ base: BASE, dataDir: DATA_DIR }),
    spaFallback404Plugin({ pathSegmentsToKeep: basePathSegmentsCount(BASE) }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
