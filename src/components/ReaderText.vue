<script setup>
/**
 * 教材本文と HomePage のフォントサイズプレビューで共通利用する
 * タイポグラフィコンポーネント。
 *
 * font-family / font-weight / font-optical-sizing / color、および
 * `--reader-font-scale` を組み込んだ font-size の clamp 計算式をここに
 * 集約することで、ReaderPage の本文と HomePage プレビューが乖離しないようにする。
 *
 * 教材データ中の <b> (アクセント母音強調) と <u> (グルーピング下線) 装飾は
 * `:deep()` セレクタで本コンポーネント内のみに閉じる。設計根拠は
 * Documents/reader-typography.md を参照。
 *
 * 使い方:
 * - `html` prop に描画したい文字列を渡す (v-html で展開される)。
 *   教材行 HTML でも静的プレビュー文字列でも同じインタフェースを使う。
 */
defineProps({
  html: { type: String, required: true },
})
</script>

<template>
  <div
    class="reader-text"
    v-html="html"
  />
</template>

<style scoped>
/*
 * フォントサイズ調整手順
 * - clamp(最小値, 可変値, 最大値) で指定しています。
 * - 全体的に文字を大きく/小さくしたい場合は 3 つの値をすべて同じ比率で増減してください。
 * - 画面幅への追従の強さを変えたい場合は中央 (vw 単位) の値だけを変更してください。
 * - 例: 元のサイズに戻す → clamp(1.5rem, 4vw, 2.75rem)
 *
 * --reader-font-scale はユーザーの HomePage スライダー設定値で、
 * src/composables/useFontScale.js が documentElement に書き込む。
 * 既定値 1 は localStorage 未保存時のフォールバックで、CSS 変数の
 * 第二引数 (`var(name, fallback)`) として渡している。
 *
 * フォント / 配色設計の根拠と調整指針は
 * Documents/reader-typography.md を参照。
 * 色値はハードコードせず Vuetify テーマ変数 (src/plugins/vuetify.js) 経由。
 */
.reader-text {
  font-size: clamp(
    calc(3rem * var(--reader-font-scale, 1)),
    calc(8vw * var(--reader-font-scale, 1)),
    calc(5.5rem * var(--reader-font-scale, 1))
  );
  line-height: 1.5;
  width: 100%;
  /*
   * OS 標準セリフフォントのフォールバックスタック (外部フォントファイル不要)
   *
   * ui-serif  — CSS Fonts Level 4 のシステム UI serif キーワード
   *             Apple (iOS/macOS) → New York (可変フォント、opsz / wght 軸あり)
   *             Windows (Chrome/Edge) → Georgia 相当
   *             Android (Chrome) → システム既定 serif (多くは Noto Serif)
   * 'New York' — ui-serif 非対応の旧ブラウザ向け Apple 明示指定
   * 'Noto Serif' — Android 標準 serif の明示指定
   * Georgia   — Windows / 全プラットフォームの web-safe serif 安全網
   * Cambria   — Windows 追加フォールバック (本文組みに適した設計)
   * serif     — ジェネリック最終フォールバック
   *
   * font-weight: 500 について:
   *   New York / Noto Serif は可変フォントのため 500 が有効。
   *   Georgia / Cambria は 400/700 のみのため 500 は 400 として描画される (許容範囲)。
   * font-optical-sizing: auto について:
   *   New York は opsz 軸をサポート。Georgia/Cambria では無視されるが問題なし。
   */
  font-family: ui-serif, 'New York', 'Noto Serif', Georgia, Cambria, serif;
  font-weight: 500;
  font-optical-sizing: auto;
  color: rgb(var(--v-theme-readerBody));
}

/* 教材コンテンツ中の <b> 要素に対するスタイル
 * シャドーイングのアクセント母音強調用途。
 *  - 色: アンバー (赤の否定感を避けつつ黒背景で見つけやすい)
 *  - ウェイト: 700
 * 詳細は Documents/reader-typography.md を参照。 */
.reader-text :deep(b) {
  font-weight: 700;
  color: rgb(var(--v-theme-readerAccent));
}

/* 教材コンテンツ中の <u> 要素に対するスタイル
 * 句のまとまりを示す補助記号。文字色は本文のまま、下線だけを強調する。
 * 詳細は Documents/reader-typography.md を参照。 */
.reader-text :deep(u) {
  color: inherit;
  text-decoration-line: underline;
  text-decoration-color: rgba(var(--v-theme-readerUnderline), 0.9);
  text-decoration-thickness: 0.1em;
  text-underline-offset: 0.14em;
  text-decoration-skip-ink: none;
}
</style>
