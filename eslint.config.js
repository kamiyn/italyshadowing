// Flat ESLint config. Uses @nuxt/eslint-config (Nuxt 4 standard) as a coding
// convention even though this app is not a Nuxt app.
import { createConfigForNuxt } from '@nuxt/eslint-config/flat'
import globals from 'globals'

export default createConfigForNuxt({
  features: {
    stylistic: true,
  },
})
  .append({
    name: 'italyshadowing/ignores',
    ignores: [
      'dist/**',
      'node_modules/**',
      'data/**',
      'public/**',
    ],
  })
  .append({
    name: 'italyshadowing/rules',
    rules: {
      // v-html is required by spec: lessons embed simple HTML markup like <b>.
      // Data is repository-managed and trusted (see Architecture.md).
      'vue/no-v-html': 'off',
    },
  })
  .append({
    name: 'italyshadowing/scripts-node',
    files: ['scripts/**/*.{js,mjs}', 'vite.config.js', 'vite/**/*.{js,mjs}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  })
