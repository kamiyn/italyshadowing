import { defineConfig } from 'rolldown-vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import { fileURLToPath, URL } from 'node:url'
import { resolveBase, basePathSegmentsCount } from './vite/resolveBase.js'
import spaFallback404Plugin from './vite/spaFallback404Plugin.js'

const BASE = resolveBase()

export default defineConfig({
  base: BASE,
  plugins: [
    vue(),
    vuetify({ autoImport: true }),
    spaFallback404Plugin({ pathSegmentsToKeep: basePathSegmentsCount(BASE) }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
