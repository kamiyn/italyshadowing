import { defineConfig } from 'rolldown-vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { execSync } from 'node:child_process'
import { resolveBase, basePathSegmentsCount } from './vite/resolveBase.js'
import spaFallback404Plugin from './vite/spaFallback404Plugin.js'
import baseRewritePlugin from './vite/baseRewritePlugin.js'

const BASE = resolveBase()
const COMMIT_HASH_FALLBACK = 'unknown'

function resolveCommitHash() {
  const fromEnv = process.env.GITHUB_SHA?.trim()
  if (fromEnv) return fromEnv.slice(0, 7)
  try {
    return execSync('git rev-parse --short=7 HEAD', { encoding: 'utf8' }).trim()
  }
  catch {
    return COMMIT_HASH_FALLBACK
  }
}

const COMMIT_HASH = resolveCommitHash()

export default defineConfig({
  base: BASE,
  define: {
    __COMMIT_HASH__: JSON.stringify(COMMIT_HASH),
  },
  plugins: [
    vue(),
    spaFallback404Plugin({ pathSegmentsToKeep: basePathSegmentsCount(BASE) }),
    baseRewritePlugin(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
