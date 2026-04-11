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

createApp(App).use(router).use(vuetify).mount('#app')
