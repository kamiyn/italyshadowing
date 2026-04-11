// Centralized lesson data accessors.
//
// data/*.json は Vite の `import.meta.glob({ eager: true })` で **build / dev
// 両方で JS バンドルへ inline** する。これにより runtime fetch は発生せず、
// iPhone Safari の積極的なキャッシュで古い JSON が返される問題が構造的に
// 解消する。dist/ に data/ ディレクトリは生成されず、Vite の JS バンドル
// content hash がそのままキャッシュバスティング機構として働く。
//
// dev では各 JSON ファイルが Vite の module graph に取り込まれ、ファイル編集
// で HMR (importing module の invalidate → HomePage / ReaderPage の再評価)
// が走る。
//
// 詳細: ADR-001 (filename pattern) / ADR-003 (build pipeline) / Architecture.md
// (システム全体像)。

const FILENAME_PATTERN = /^[A-Za-z0-9_-]+$/

// 第二引数 `import: 'default'` で各 JSON モジュールの default export を直接取り
// 出す (ラッパオブジェクト `{ default: ... }` を剥がす)。`eager: true` で同期
// 取り込みになるため runtime にネットワークも Promise も介在しない。
const lessonModules = import.meta.glob('../../data/*.json', {
  eager: true,
  import: 'default',
})

// 起動時に 1 度だけ map を構築する。fail-loud 検証 (defense in depth)。
//
// メインの build-time 検証は scripts/validate-lessons.mjs が
// `npm run build` の最初のステップ (Node プロセス) で走らせるため、
// CI / ローカル build はそこで止まる。本ブロックは validate-lessons を
// 経由しない `vite dev` 直接起動や、何らかの経路でバンドルが browser に
// 落ちた場合の最終防御として並走する。
//
// 詳細: ADR-001 (4 箇所重複管理) / ADR-003 (build pipeline 3 ステップ)。
const lessons = Object.fromEntries(
  Object.entries(lessonModules).map(([modulePath, lesson]) => {
    const filename = modulePath.split('/').pop().replace(/\.json$/, '')
    if (!FILENAME_PATTERN.test(filename)) {
      throw new Error(
        `Invalid lesson filename: "${filename}.json" — must match ${FILENAME_PATTERN}. `
        + `See README.md "教材ファイル名の制約".`,
      )
    }
    return [filename, lesson]
  }),
)

function encodeLessonFilename(filename) {
  if (typeof filename !== 'string' || !FILENAME_PATTERN.test(filename)) {
    throw new Error('Invalid lesson filename')
  }
  // 旧実装では URL 組み立てに使っていた。inline 化後は lookup key にしか使わない
  // ので encodeURIComponent 結果は事実上の no-op だが、防御的バリデーションの
  // 接点として残しておく。
  return encodeURIComponent(filename)
}

// HomePage 互換 API。旧実装は data/index.json を fetch していたが、現在は
// inline 済み lessons から動的に組み立てる。並び順は filename 昇順 (旧
// generate-index.mjs と同じ semantics)。
export async function fetchIndex() {
  const list = Object.entries(lessons)
    .map(([filename, lesson]) => ({
      filename,
      title: typeof lesson.title === 'string' ? lesson.title : '',
      description: typeof lesson.description === 'string' ? lesson.description : '',
    }))
    .sort((a, b) => a.filename.localeCompare(b.filename))
  return { lessons: list }
}

// ReaderPage 互換 API。
//
// 旧実装は第 2 引数 `{ signal }` で AbortController を受け取り、in-flight
// fetch を中断していた。inline 化後は同期解決なので signal の出番が無く、
// 第 2 引数を無視する形にする (呼び出し側 ReaderPage が `fetchLesson(name,
// { signal })` の形で渡しても JS はサイレントに無視するため、call site の
// 既存コードを変更せずに済む。Promise の microtask 解決が一瞬で終わるため
// abort と解決の競合は呼び出し側の既存ロジックで吸収される)。
export async function fetchLesson(filename) {
  const safeFilename = encodeLessonFilename(filename)
  const lesson = lessons[safeFilename]
  if (!lesson) {
    throw new Error(`Lesson not found: ${filename}`)
  }
  return lesson
}
