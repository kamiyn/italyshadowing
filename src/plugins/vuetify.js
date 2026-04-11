import 'vuetify/styles'
import { createVuetify } from 'vuetify'

// 既定テーマはダークモード。背景は純黒 (#000000) を使い、シャドーイング中の
// 視覚ノイズを最小化する。
//
// Reader 向けカスタムカラー (CLAUDE.md 規約の「色はテーマ変数経由」原則):
//   - readerBody     : 教材本文。純白だと黒背景でコントラスト過剰になり眼が
//                      疲れるため、暖色寄りのオフホワイト (#F2F0EA) を採用
//   - readerAccent   : <b> アクセント母音強調。赤系はエラーを連想させやすいため
//                      暖色アンバー (#FFC766) を採用
//   - readerUnderline: <u> 句のまとまり線。文字色は変えず、淡い水色 (#B4DCFF)
//                      の下線で「グルーピング」の補助記号として表現
//
// これらは Vuetify が自動で `--v-theme-readerBody` 等の CSS 変数を生成する。
// 各コンポーネントの `<style>` からは rgb(var(--v-theme-readerBody)) のように
// 参照することで、ハードコードを避けつつ集中管理できる。
export const vuetify = createVuetify({
  theme: {
    defaultTheme: 'dark',
    themes: {
      dark: {
        dark: true,
        colors: {
          background: '#000000',
          surface: '#000000',
          readerBody: '#F2F0EA',
          readerAccent: '#FFC766',
          readerUnderline: '#B4DCFF',
        },
      },
    },
  },
})
