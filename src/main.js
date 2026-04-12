import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router/index.js'

// グローバルテーマ (CSS カスタムプロパティ + ミニマルリセット)。
// Vuetify が自動生成していた --v-theme-* 変数を自前で定義する。
import './assets/theme.css'

// Reader 本文用フォントを npm パッケージ経由でビルドに埋め込む。
// `roboto-serif-latin.css` は @fontsource-variable/roboto-serif/standard.css
// から **latin subset の @font-face ブロックだけを cherry-pick** したカスタム
// CSS。本アプリはイタリア語のシャドーイング用途で cyrillic / latin-ext /
// vietnamese を必要としないため、不要 subset の woff2 が dist/ にコピーされ
// るのを防ぐ目的。標準 standard.css をそのまま import すると 5 subset 分
// (約 1 MB) が dist/assets/ に出力されてしまう。
//
// woff2 ファイルは wght / opsz / wdth の variable 軸を含む "standard" 軸変種
// を使用するため、font-weight 500/700 と font-optical-sizing: auto の両方が
// 動作する。Google Fonts CDN ではなく self-host することで CDN 依存を減らし、
// フォント読み込み挙動を制御しやすくして FOUT の発生を抑えやすくする。
// 詳細: Documents/reader-typography.md / src/assets/fonts/roboto-serif-latin.css
import './assets/fonts/roboto-serif-latin.css'

// useFontScale のモジュール初期化を起動時に走らせ、--reader-font-scale を
// localStorage の保存値で documentElement に適用してから最初のレンダリングが
// 走るようにする。これがないと /reader/foo に直アクセスした際に一瞬 1.0 倍の
// 文字が見えてからユーザー設定値に切り替わる FOUC が出る。
import './composables/useFontScale.js'

createApp(App).use(router).mount('#app')
