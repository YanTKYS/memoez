# MemoEZ v0.1.6-beta リリースノート

## 主要変更点
1. 期限・リマインドのデータモデル追加（DB互換 migration 含む）。
2. 期限表示・期限順ソート・編集画面での期限プリセット入力を実装。
3. リマインダースケジューラ導入（作成/更新/削除時に再設定）。
4. JSON backup/export/import を実装（merge / overwrite）。

## 実機確認ポイント
- 期限設定 → 一覧反映 → 編集再表示が正しいこと
- 期限切れ表示が分かりやすいこと
- backup の export/import が期待通り動くこと

## 既知の制限
- OSネイティブ通知（expo-notifications 等）への接続は未実装。
- import/export の設定画面導線は後続対応。
