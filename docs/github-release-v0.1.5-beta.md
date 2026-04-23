# v0.1.5-beta GitHub Release Draft

## Title
`v0.1.5-beta: 実機確認用APKリリース`

## Note
MemoEZ `v0.1.5-beta` の実機確認向け APK リリースです。

### 変更ハイライト
- `useEditNote` の責務分割（ラベル関連処理を `useNoteLabelActions` へ分離）
- `useSearch` の検索分岐を `searchQueryPlan` に整理（label / keyword 複合対応）
- `DrizzleNoteRepository` の active-note helper 共通化
- ラベル管理導線を整理（メモ画面からラベル管理画面へ遷移）
- Android CI / release workflow の安定化改善を継続

### 実機確認観点
- メモ作成/編集/削除、ラベル付与/解除
- ラベル管理画面での作成/編集/削除
- 検索（キーワードのみ / ラベルのみ / 複合）
- 既存データ（SQLite）互換性

### 互換性
- App Version: `0.1.5`
- Android `versionCode`: `6`

### 注意事項
- 本リリースはベータ版（実機確認用）です。
