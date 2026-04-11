import { defineConfig } from 'rolldown-vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import { fileURLToPath, URL } from 'node:url'
import { promises as fs } from 'node:fs'
import path from 'node:path'

// actions/configure-pages が build job で export する ASSET_PREFIX (URL のパス部分)
// が存在する場合はそれを優先する。リポジトリ名変更やカスタムドメイン追加時に
// このファイルのハードコード値とのズレ事故を防ぐため。CI 外 (dev / ローカル build)
// では未設定なので、フォールバックとしてリポジトリ名のサブパスを使う。
function normalizeBasePath(basePath) {
  return basePath.endsWith('/') ? basePath : `${basePath}/`
}

function resolveRepoSubpath() {
  const packageName = process.env.npm_package_name
  if (packageName) {
    const repoName = packageName.split('/').filter(Boolean).pop()
    if (repoName) return `/${repoName}/`
  }

  const githubRepository = process.env.GITHUB_REPOSITORY
  if (githubRepository) {
    const repoName = githubRepository.split('/').filter(Boolean).pop()
    if (repoName) return `/${repoName}/`
  }

  return '/italyshadowing/'
}

function resolveBase() {
  // ASSET_PREFIX が「未設定」と「明示的に空文字」では意味が異なる:
  //   - 未設定 (undefined): configure-pages が走っていないローカル / CI 外 →
  //     リポジトリ名のサブパスにフォールバック
  //   - 空文字 ('')   : カスタムドメインなどでルート配備する明示的指示 → '/'
  // truthy 判定 (`if (fromEnv)`) だと空文字をフォールバック側に流してしまい
  // ルート配備時にアセット URL が壊れるため、null/undefined だけを未設定として扱う。
  const fromEnv = process.env.ASSET_PREFIX
  if (fromEnv == null) return resolveRepoSubpath()
  return normalizeBasePath(fromEnv)
}

const BASE = resolveBase()
const DATA_DIR = fileURLToPath(new URL('./data', import.meta.url))

// SPA 404 フォールバックの「保持セグメント数」は base に対応している必要がある:
//   - '/'                 → 0 (ルート配備, カスタムドメイン)
//   - '/italyshadowing/'  → 1 (GitHub Pages の <user>.github.io/italyshadowing/)
//   - '/foo/bar/'         → 2 (二段サブパス)
// 旧 public/404.html はこの値を 1 で固定していたため、ルート配備時に
// /lesson-name の直リンクでフォールバックが壊れていた。base から動的に算出する。
function basePathSegmentsCount(base) {
  return base.split('/').filter(Boolean).length
}

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
        const normalizedRel = path.posix.normalize(rel).replace(/^\/+/, '')
        const dataDirRoot = path.resolve(DATA_DIR)
        const filePath = path.resolve(dataDirRoot, normalizedRel)
        // Disallow path traversal and absolute-path escapes.
        if (filePath !== dataDirRoot && !filePath.startsWith(dataDirRoot + path.sep)) {
          res.statusCode = 400
          return res.end('bad request')
        }
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

// Emit dist/404.html with the SPA fallback shim baked to the resolved base.
// Replaces the previous static public/404.html which had pathSegmentsToKeep
// hard-coded to 1 and broke root deployments.
function spaFallback404Plugin() {
  const pathSegmentsToKeep = basePathSegmentsCount(BASE)
  return {
    name: 'italyshadowing-spa-fallback-404',
    apply: 'build',
    generateBundle() {
      const html = `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <title>Italy Shadowing</title>
    <!--
      SPA single page apps for GitHub Pages — adapted from
      https://github.com/rafgraph/spa-github-pages (MIT).
      pathSegmentsToKeep is generated at build time from vite \`base\`
      so that root deploys (custom domain → base = '/') and subpath
      deploys (e.g. /italyshadowing/) both work without manual edits.
    -->
    <script>
      (function (l) {
        var pathSegmentsToKeep = ${pathSegmentsToKeep}
        l.replace(
          l.protocol + '//' + l.hostname + (l.port ? ':' + l.port : '')
            + l.pathname.split('/').slice(0, 1 + pathSegmentsToKeep).join('/')
            + '/?/'
            + l.pathname.slice(1).split('/').slice(pathSegmentsToKeep).join('/').replace(/&/g, '~and~')
            + (l.search ? '&' + l.search.slice(1).replace(/&/g, '~and~') : '')
            + l.hash,
        )
      }(window.location))
    </script>
  </head>
  <body></body>
</html>
`
      this.emitFile({
        type: 'asset',
        fileName: '404.html',
        source: html,
      })
    },
  }
}

export default defineConfig({
  base: BASE,
  plugins: [
    vue(),
    vuetify({ autoImport: true }),
    dataDirPlugin(),
    spaFallback404Plugin(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
