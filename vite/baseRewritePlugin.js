// Vite は index.html 内の <link rel="manifest"> や <link rel="apple-touch-icon"> の
// href を base で書き換えない。このプラグインは該当する相対パスに base をプレフィクス
// して、サブパス配備 (/italyshadowing/ 等) でも正しく解決されるようにする。
export default function baseRewritePlugin() {
  return {
    name: 'italyshadowing-base-rewrite',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const resolvedBase = ctx.server?.config.base
          ?? this.environment?.config?.base
          ?? '/'
        return html.replace(
          /(<link\s[^>]*(?:rel="(?:manifest|apple-touch-icon)")[^>]*\shref=")([^"]+)(")/g,
          (match, before, href, after) => {
            if (href.startsWith('/') || href.startsWith('http')) return match
            return `${before}${resolvedBase}${href}${after}`
          },
        )
      },
    },
  }
}
