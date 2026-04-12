<script setup>
</script>

<template>
  <v-app>
    <router-view />
  </v-app>
</template>

<style>
/*
 * viewport-fit=cover (index.html) により、standalone モードで
 * ビューポートが notch / home indicator 領域まで広がる。
 * 全ページ共通で safe-area padding を掛けてコンテンツの重なりを防ぐ。
 * 通常ブラウザでは env() は 0px になるため影響なし。
 */
.v-application {
  padding:
    env(safe-area-inset-top, 0px)
    env(safe-area-inset-right, 0px)
    env(safe-area-inset-bottom, 0px)
    env(safe-area-inset-left, 0px);
}
</style>
