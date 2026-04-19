# v0.1.6-beta GitHub Release Draft

## Title
`v0.1.6-beta: 実機確認用APKリリース（期限・通知 + backup I/O）`

## Note
MemoEZ `v0.1.6-beta` の実機確認向け APK リリースです。

### 変更ハイライト
- 期限日時 (`dueAt`) とリマインド (`reminderAt`) の保存・表示・編集導線を追加
- 期限順ソート（期限未設定は後ろ）と期限表示/期限切れ表示をノート一覧へ反映
- リマインダースケジューラ（抽象レイヤ）を追加し、保存/更新/削除時の再設定を実装
- JSON バックアップの export/import（merge / overwrite）を実装

### 実機確認観点
- 期限設定（今日/明日/1週間後/解除）と表示更新
- 期限切れ表示（色・アイコン）
- 保存後の再起動時データ整合性（due/reminder値）
- backup export/import（merge / overwrite）の基本動作

### 互換性
- App Version: `0.1.5`
- 想定タグ: `v0.1.6-beta`

### 注意事項
- 本リリースはベータ版（実機確認用）です。
- 通知は現時点でスケジューラ抽象実装であり、OSネイティブ通知統合は後続作業です。
