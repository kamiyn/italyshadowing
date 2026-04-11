import { defineConfig } from 'rolldown-vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import { fileURLToPath, URL } from 'node:url'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const BASE = '/italyshadowing/'
const DATA_DIR = fileURLToPath(new URL('./data', import.meta.url))

// Serve repo-root data/ during dev and copy it into dist/data/ at build time.
// Kept inline to avoid an extra dependency on vite-plugin-static-copy.
function dataDirPlugin() {
  const urlPrefixes = ['/data/', `${BASE}data/`]
  // Captured from configResolved so we always copy into the actual build
  // output directory, not a hard-coded ./dist path. Honors any user override
  // of build.outDir or alternate build modes/targets.
  let resolvedOutDir = null

  async function copyRecursive(src, dest) {
    await fs.mkdir(dest, { recursive: true })
    const entries = await fs.readdir(src, { withFileTypes: true })
    for (const entry of entries) {
      const s = path.join(src, entry.name)
      const d = path.join(dest, entry.name)
      if (entry.isDirectory()) {
        await copyRecursive(s, d)
      }
      else if (entry.isFile()) {
        await fs.copyFile(s, d)
      }
    }
  }

  return {
    name: 'italyshadowing-data-dir',
    configResolved(config) {
      resolvedOutDir = path.resolve(config.root, config.build.outDir)
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || ''
        const matched = urlPrefixes.find(p => url.startsWith(p))
        if (!matched) return next()
        const rel = url.slice(matched.length).split('?')[0]
        // Disallow path traversal.
        if (rel.includes('..')) {
          res.statusCode = 400
          return res.end('bad request')
        }
        const filePath = path.join(DATA_DIR, rel)
        try {
          const data = await fs.readFile(filePath)
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.setHeader('Cache-Control', 'no-store')
          res.end(data)
        }
        catch {
          res.statusCode = 404
          res.end('not found')
        }
      })
    },
    async closeBundle() {
      if (!resolvedOutDir) {
        throw new Error('italyshadowing-data-dir: outDir not resolved before closeBundle')
      }
      await copyRecursive(DATA_DIR, path.join(resolvedOutDir, 'data'))
    },
  }
}

export default defineConfig({
  base: BASE,
  plugins: [
    vue(),
    vuetify({ autoImport: true }),
    dataDirPlugin(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
