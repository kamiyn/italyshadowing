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
 * - ReaderPage は教材行 HTML を `html` prop で渡す (innerHTML として展開)。
 * - HomePage プレビュー等で静的テキストを描画する場合は default slot を使う。
 * - `nowrap` は HomePage プレビュー専用の修飾子。1 行で固定し横幅を内容に
 *   合わせるため、親コンテナ側で flex 中央寄せ + overflow:hidden することで
 *   高 font-scale 時にも左右対称に切り落とせる。
 */
defineProps({
  html: { type: String, default: '' },
  nowrap: { type: Boolean, default: false },
})
</script>

<template>
  <div
    v-if="html"
    class="reader-text"
    :class="{ 'reader-text--nowrap': nowrap }"
    v-html="html"
  />
  <div
    v-else
    class="reader-text"
    :class="{ 'reader-text--nowrap': nowrap }"
  >
    <slot />
  </div>
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
  font-family: 'Roboto Serif Variable', 'Roboto Serif', serif;
  font-weight: 500;
  font-optical-sizing: auto;
  color: rgb(var(--v-theme-readerBody));
}

/*
 * HomePage プレビュー用バリアント。1 行で固定し、横幅は内容に合わせる。
 * 親 (.font-size-preview-box) で flex 中央寄せ + overflow:hidden しているため、
 * 高 font-scale で内容が画面幅を超えても左右対称に切り落とされる。
 * 単一行表示なので line-height は本文より詰める。
 */
.reader-text--nowrap {
  white-space: nowrap;
  width: auto;
  flex-shrink: 0;
  line-height: 1.2;
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
