# ADR-005: localStorage への保存はオプショナル動作として扱う

## Status

Accepted

## Context

ユーザー設定 (例: `useFontScale` の表示倍率) をブラウザに永続化する際、第一候補は `localStorage` だが、`localStorage.setItem` / `getItem` はユーザー側に制御不能な理由で簡単に throw する。

代表的な失敗ケース:

- **QuotaExceededError**: ブラウザのストレージ上限到達 (他の origin / extension で食い潰されているケースもある)
- **SecurityError (Safari private browsing)**: 旧 Safari の private mode は `setItem` を即 throw する。一部バージョンは `getItem` も throw する
- **企業端末 / コーポレート GPO によるストレージ無効化**: cookie / storage を policy で無効化されている環境
- **iframe sandbox**: `sandbox` 属性で `allow-same-origin` が無いと storage 全般が throw する

これを bare のまま Vue の `watch` / イベントハンドラに置くと、設定スライダーを動かしただけで例外が watcher 連鎖を壊し UI が落ちる。

## Decision

**ブラウザ永続化 API (`localStorage` / `sessionStorage` / `IndexedDB` 等) への書き込み・読み込みは必須動作ではなく "best-effort なオプショナル動作" として扱う。** 失敗は try/catch で握りつぶし、in-memory のリアクティブ状態だけでそのセッションは正しく機能させる。

## Rationale

- 永続化はあくまで "次回起動時の利便性" のためのものであり、機能の核 (= ユーザーがその場で操作した結果がそのセッションで反映されること) は in-memory 状態で完結している。
- 永続化失敗時の degraded experience は「次回起動時にデフォルト値に戻る」だけで、ユーザーがその場で気付くほどの不便ではない。
- 一方、永続化失敗を throw のまま伝播させると、設定 UI の操作 1 つでアプリ全体の挙動が壊れる可能性があり、リスクとリターンが釣り合わない。

## How to apply

- `localStorage.setItem` / `getItem` / `removeItem` (および `sessionStorage` 系) は **必ず try/catch で囲む**
- catch ブロックでは原則何もしない (必要ならログのみ)。throw 再送出はしない
- in-memory のリアクティブ状態 (Vue ref / `applyToDom` などの DOM 反映) の更新は try/catch の **外** または **前** に行い、永続化失敗時もそのセッション中は機能し続けるようにする
- Vue の `watch` 内で永続化を行う場合は特に注意。watcher 内部の throw は Vue がコンソール警告を出すだけで済むケースもあるが、HMR や test 環境では握りつぶしておく方が事故が少ない

## 例外

永続化が機能の核となるケース (例: ドキュメントエディタの save、ユーザーが入力した教材データの保存) は本 ADR の対象外。その場合は失敗をユーザーに明示し、再試行 / ダウンロード等の代替手段を提示すること。

## Consequences

- Pros: ストレージ制約のあるブラウザ / 環境でも UI が落ちない。Safari private mode / 企業端末でも degrade で済む。
- Cons: 永続化失敗がサイレントになるため、デバッグ時に「保存したはずなのに次回反映されない」原因の追跡がやや難しい。コンソールログを残すかは案件次第。
- 参照実装: `src/composables/useFontScale.js` の `loadInitial()` / `persistFontScale()` 内 try/catch

## References

- WHATWG HTML Living Standard "The localStorage attribute": https://html.spec.whatwg.org/multipage/webstorage.html#the-localstorage-attribute
- MDN "Storage API: setItem() — Exceptions": https://developer.mozilla.org/en-US/docs/Web/API/Storage/setItem#exceptions
- 実装: `src/composables/useFontScale.js`
- CLAUDE.md (永続化 API のオプショナル扱い一般則)
