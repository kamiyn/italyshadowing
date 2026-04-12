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
 * notch との重なりは許容する — 頻繁に使う操作ではなく、端末の縦横回転で
 * 回避できるため、グローバルな safe-area padding は掛けない。
 * 詳細: Documents/pwa-standalone.md
 */
</style>
