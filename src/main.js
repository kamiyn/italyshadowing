import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router/index.js'
import { vuetify } from './plugins/vuetify.js'

// Reader 本文用フォントを npm パッケージ経由でビルドに埋め込む。
// `standard.css` は wght / opsz / wdth の variable 軸をまとめて含むため、
// font-weight 500/700 と font-optical-sizing: auto の両方が動作する。
// Google Fonts CDN ではなく self-host することで CDN 依存を減らし、
// フォント読み込み挙動を制御しやすくして、FOUT の発生を抑えやすくする。
// 参照: Documents/reader-typography.md
import '@fontsource-variable/roboto-serif/standard.css'

// useFontScale のモジュール初期化を起動時に走らせ、--reader-font-scale を
// localStorage の保存値で documentElement に適用してから最初のレンダリングが
// 走るようにする。これがないと /reader/foo に直アクセスした際に一瞬 1.0 倍の
// 文字が見えてからユーザー設定値に切り替わる FOUC が出る。
import './composables/useFontScale.js'

createApp(App).use(router).use(vuetify).mount('#app')
