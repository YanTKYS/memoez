# v0.1.4-beta GitHub Release Draft

## Title
`v0.1.4-beta: 実機テスト用APKリリース`

## Note
MemoEZ `v0.1.4-beta` の実機テスト向け APK リリースです。

### 変更ハイライト
- Android CI の安定化（Kotlin/Gradle 設定見直し、失敗ログ改善）
- ノートのソフト削除運用を強化（削除済みデータへの更新防止）
- ラベル名の一意性を DB レベルで強化（`deleted_at IS NULL` 条件付きユニーク）
- ノート削除失敗時の UI エラーハンドリング改善
- リリース運用ドキュメント（チェックリスト/ノート）を整備

### テスト観点（実機）
- 起動、メモ作成/編集/削除、検索
- ラベル作成/編集/削除
- 既存 SQLite データの継続利用

### 互換性
- App Version: `0.1.4-beta`
- Android `versionCode`: `4`

### 注意事項
- 本リリースはベータ版（実機検証用）です。
