import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router/index.js'

// グローバルテーマ (CSS カスタムプロパティ + ミニマルリセット)。
// Vuetify が自動生成していた --v-theme-* 変数を自前で定義する。
import './assets/theme.css'

// useFontScale のモジュール初期化を起動時に走らせ、--reader-font-scale を
// localStorage の保存値で documentElement に適用してから最初のレンダリングが
// 走るようにする。これがないと /reader/foo に直アクセスした際に一瞬 1.0 倍の
// 文字が見えてからユーザー設定値に切り替わる FOUC が出る。
import './composables/useFontScale.js'

createApp(App).use(router).mount('#app')
