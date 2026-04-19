# v0.1.5 GitHub Release Draft

## Title
`v0.1.5: リファクタリング安定化リリース`

## Note
MemoEZ `v0.1.5` の正式 APK リリースです。
`v0.1.5-beta` 実機確認結果を反映し、リファクタリング成果を本番運用向けに安定化しました。

### 変更ハイライト
- `useEditNote` からラベル責務を `useNoteLabelActions` に分離
- `useSearch` の検索分岐を `searchQueryPlan` として明確化
- `DrizzleNoteRepository` の active-note 判定を helper 化し重複条件を削減
- ラベル管理導線を整理（メモ画面からラベル管理画面へ遷移）
- Android CI / release workflow の安定化改善を継続

### 実機確認ポイント（v0.1.5-betaで確認済み）
- メモ作成/編集/削除
- ラベル付与/解除、ラベル管理画面での作成/編集/削除
- 検索（キーワードのみ / ラベルのみ / 複合）
- SQLite 既存データ互換性

### 互換性
- App Version: `0.1.5`
- Android `versionCode`: `6`

### 注意事項
- 次バージョン `v0.1.6` では「期限・リマインド」「インポート・エクスポート」を計画。
