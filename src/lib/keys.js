// KeyboardEvent.key constants.
//
// 出典: W3C UI Events KeyboardEvent key Values
//   https://www.w3.org/TR/uievents-key/
//   - Whitespace keys (Space):
//     https://www.w3.org/TR/uievents-key/#keys-whitespace
//     Space の key 値は半角スペース 1 文字 (U+0020) と規定されています。
//   - Named key attribute values (Enter, Arrow*):
//     https://www.w3.org/TR/uievents-key/#named-key-attribute-values
//
// なぜ定数化するか:
//   - ソース上で `' '` や `'ArrowUp'` を直書きすると、可読性が低く、タイポや
//     不可視文字 (全角スペース・NBSP) の混入を lint では拾えません。
//   - 定数名で参照することで grep 性 / 意図 / スペック出典がすべて揃います。
//
// TypeScript の型定義のみを提供する npm モジュール (ランタイム JS を含まない
// もの) が見つかった場合はここを差し替え可能です。現時点では該当する純粋な
// types-only パッケージが見当たらず、本プロジェクトは JavaScript で書かれて
// いるため、ローカル定数で十分です。

export const KEY_SPACE = ' '
export const KEY_ENTER = 'Enter'
export const KEY_ARROW_UP = 'ArrowUp'
export const KEY_ARROW_DOWN = 'ArrowDown'
export const KEY_ARROW_LEFT = 'ArrowLeft'
export const KEY_ARROW_RIGHT = 'ArrowRight'
