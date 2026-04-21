# v0.1.6 GitHub Release Draft

## Title
`v0.1.6: 期限・通知とバックアップI/Oを強化した安定化リリース`

## Note
MemoEZ `v0.1.6` リリースです。

### ハイライト
- 期限・通知フローを実利用向けに改善
  - カレンダー日付選択 + 時分選択の日時入力 UI
  - 期限表示・期限解除・通知ガイドを整備
- バックアップI/O を実装
  - JSON export/import（merge / overwrite）
  - 保存先/読込先フォルダの選択（初期値: Download）
- データ互換性と品質を強化
  - DB migration と soft-delete 安全化
  - backup / scheduler / search / sort / label のテスト拡充

### 主な確認観点
- 期限設定・解除・編集
- backup export/import の運用
- 既存データ更新後の互換性

### 注意事項
- OS ネイティブ通知連携（expo-notifications）は後続フェーズで対応予定
