// Emit dist/404.html with the SPA fallback shim baked to the resolved base.
// Replaces the previous static public/404.html which had pathSegmentsToKeep
// hard-coded to 1 and broke root deployments.
export default function spaFallback404Plugin({ pathSegmentsToKeep }) {
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
