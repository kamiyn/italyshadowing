# main ブランチ保護ルール

## 概要

main ブランチへの直接 push を禁止し、Pull Request 経由のマージのみを許可する。GitHub の Repository Rulesets で管理する。

## 現行ルール

| 項目 | 設定 |
|---|---|
| ルール名 | `protect-main` |
| 対象 | `refs/heads/main` |
| enforcement | `active` |
| 必須ルール | `pull_request` |

このドキュメントの `gh api` 用 JSON は「PR を作成してマージする」ことを必須にする `pull_request` ルールを設定する例であり、レビュー承認数は明示していない。現行設定の承認数まで厳密に一致させたい場合は、`gh api repos/{owner}/{repo}/rulesets/{ruleset_id}` または GitHub Web UI で実際のパラメータを確認すること。

## 作成コマンド

```bash
gh api repos/{owner}/{repo}/rulesets \
  -X POST \
  --input - <<'EOF'
{
  "name": "protect-main",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "include": ["refs/heads/main"],
      "exclude": []
    }
  },
  "rules": [
    { "type": "pull_request" }
  ]
}
EOF
```

## 確認コマンド

```bash
# ルール一覧
gh api repos/{owner}/{repo}/rulesets

# 特定ルールの詳細
gh api repos/{owner}/{repo}/rulesets/{ruleset_id}
```

## 変更・削除

```bash
# ルールを無効化 (削除せず一時停止)
gh api repos/{owner}/{repo}/rulesets/{ruleset_id} \
  -X PUT \
  --input - <<'EOF'
{
  "name": "protect-main",
  "target": "branch",
  "enforcement": "disabled",
  "conditions": {
    "ref_name": {
      "include": ["refs/heads/main"],
      "exclude": []
    }
  },
  "rules": [
    { "type": "pull_request" }
  ]
}
EOF

# ルールを削除
gh api repos/{owner}/{repo}/rulesets/{ruleset_id} -X DELETE
```

## Web UI

GitHub Web UI からも管理できる: Settings → Rules → Rulesets → `protect-main`
