# ADR-002: KeyboardEvent.key 定数をローカル `src/lib/keys.js` に置く

## Status

Accepted

## Context

キーボード操作の比較に `event.key === ' '` や `event.key === 'ArrowUp'` のような文字列リテラルを直書きすると次の問題がある。

- 全角スペース (`　`) や NBSP (`\u00A0`) など、見た目で区別できない不可視文字の混入を lint で拾えない
- grep 性が低く、どのキーがどこで使われているか俯瞰しづらい
- 仕様 (W3C UI Events KeyboardEvent key Values) の出典が明示されず、値の正しさが根拠不明になる

対策として、キー定数をどこから取得するかを検討した。

## Options

1. 既存 npm パッケージ (例: `ts-key-enum`)
2. ローカル定数モジュール `src/lib/keys.js`

## Decision

`src/lib/keys.js` にローカル定数を定義して運用する。

## Rationale

- `ts-key-enum` は TypeScript enum を runtime JS に展開するため、依存追加のコストと、tree-shaking の確実性が未保証。
- 本プロジェクトは TypeScript コンパイラを build パイプラインに持たない JavaScript 専用構成のため、types-only パッケージがあっても型チェックが走らず実益がない。
- 純粋に types-only として W3C キー値を提供するパッケージは調査時点で見当たらない。
- ローカル定数であれば依存追加ゼロ、W3C 仕様リンクをファイル先頭コメントとして直接埋め込める。

## Consequences

- Pros: 依存追加なし。出典が明示される。grep 一発で全使用箇所を追える。定数の追加は 1 行で済む。
- Cons: 新しいキーを参照する際に手で `KEY_*` を追加する必要がある。
- 将来の移行余地: TypeScript 化する場合は純粋 types-only パッケージに差し替え可能な設計にしてある (`src/lib/keys.js` 先頭コメントで明記)。

## References

- W3C UI Events KeyboardEvent key Values: https://www.w3.org/TR/uievents-key/
- 実装: `src/lib/keys.js`
- CLAUDE.md (キーボードキー文字列リテラル直書き禁止の一般則)
