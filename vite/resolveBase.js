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

export function resolveBase() {
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

// SPA 404 フォールバックの「保持セグメント数」は base に対応している必要がある:
//   - '/'                 → 0 (ルート配備, カスタムドメイン)
//   - '/italyshadowing/'  → 1 (GitHub Pages の <user>.github.io/italyshadowing/)
//   - '/foo/bar/'         → 2 (二段サブパス)
// 旧 public/404.html はこの値を 1 で固定していたため、ルート配備時に
// /lesson-name の直リンクでフォールバックが壊れていた。base から動的に算出する。
export function basePathSegmentsCount(base) {
  return base.split('/').filter(Boolean).length
}
