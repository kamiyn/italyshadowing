import 'vuetify/styles'
import { createVuetify } from 'vuetify'

// 既定テーマはダークモード。背景は純黒 (#000000) を使い、シャドーイング中の
// 視覚ノイズを最小化する。
export const vuetify = createVuetify({
  theme: {
    defaultTheme: 'dark',
    themes: {
      dark: {
        dark: true,
        colors: {
          background: '#000000',
          surface: '#000000',
        },
      },
    },
  },
})
