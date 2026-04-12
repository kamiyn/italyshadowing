# PWA Standalone モード

iPhone Safari で ReaderPage をなるべく全画面に近い表示にするための設定をまとめる。

## 概要

iOS Safari は Fullscreen API (`element.requestFullscreen()`) を未サポートのため、JS からアドレスバーを強制的に隠すことはできない。代わりに以下の 3 アプローチを組み合わせる。

| アプローチ | 効果 |
|---|---|
| PWA standalone モード | 「ホーム画面に追加」で起動するとアドレスバー/ツールバーなしの全画面表示 |
| `viewport-fit=cover` | コンテンツ領域を notch / home indicator 領域まで拡張 |
| `100dvh` | アドレスバーの出入りに連動する動的ビューポート高さ |

Safari で直接 URL を開いた場合はアドレスバーが残るが、ユーザーが下にスクロールすると自動でミニマイズされる。

## 実装構成

### `index.html`

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="theme-color" content="#121212" />
<link rel="manifest" href="manifest.webmanifest" />
<link rel="apple-touch-icon" href="apple-touch-icon.png" />
```

- `viewport-fit=cover`: ビューポートを notch 領域まで拡張
- `apple-mobile-web-app-capable`: iOS の「ホーム画面に追加」で standalone 起動を有効化
- `black-translucent`: ステータスバーを透過にしてコンテンツと一体化
- manifest / apple-touch-icon の href は相対パス。ビルド時に `baseRewritePlugin` が Vite の `base` をプレフィクスする

### `public/manifest.webmanifest`

`display: "standalone"` を指定。Service Worker は不要 (standalone 表示に SW は必須ではない)。

### `public/icon.svg` + PNG

- `icon.svg`: SVG アイコン (manifest の `sizes: "any"`)
- `icon-192.png` / `icon-512.png`: PNG フォールバック (SVG 未対応環境向け)
- `apple-touch-icon.png` (180x180): iOS ホーム画面アイコン

### `vite/baseRewritePlugin.js`

Vite は `<link rel="manifest">` や `<link rel="apple-touch-icon">` の href を `base` で書き換えない。このプラグインが `transformIndexHtml` フックで該当する相対パスに `base` をプレフィクスする。

### `src/pages/ReaderPage.vue` (CSS)

```css
/* dvh 未対応ブラウザ向けフォールバック */
min-height: calc(100vh - ...);
/* 対応ブラウザでは上書き */
min-height: calc(100dvh - ...);
```

`100dvh` (dynamic viewport height) はアドレスバーの出入りに連動する。未対応ブラウザ向けに `100vh` を先に宣言してフォールバックとする。

## 設計判断

### notch 領域との重なりは許容する

`viewport-fit=cover` により standalone モードでは notch / home indicator 領域までコンテンツが広がる。グローバルな `safe-area-inset-*` padding は掛けない。

理由:

- notch 周辺の操作は頻繁に使うものではない
- 端末の縦横回転で回避できる
- グローバル safe-area padding を掛けると ReaderPage の `min-height` 計算や Vuetify レイアウトとの整合が複雑になり、メンテナンスコストに見合わない

### `scroll-to-hide` は採用しない

`window.scrollTo(0, 1)` でアドレスバーのミニマイズを促すトリックは、最新 iOS (15+) で動作が不安定であり、ReaderPage の flex レイアウトやピンチジェスチャーと干渉するリスクがあるため採用しない。

### Service Worker は追加しない

standalone 表示に Service Worker は必須ではない。オフライン対応が必要になった段階で別途検討する。
