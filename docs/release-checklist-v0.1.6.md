# MemoEZ v0.1.6 リリースチェックリスト（期限・通知 + バックアップ）

最終更新: 2026-04-19

## リリース管理情報
- [ ] リリースオーナー:
- [ ] レビュー担当:
- [ ] 予定リリース日:
- [ ] 対象タグ: `v0.1.6`
- [ ] 対象コミットSHA:

## 0. 進め方（細切れPR回避）
- [x] v0.1.6 用チェックリストを作成し、作業開始条件を明文化（2026-04-19 実施）
- [x] 「1機能1PR」ではなく、機能フロー単位でまとめる方針を確定（2026-04-19 実施）
  - PR-A: 期限設定 + 通知スケジューリング + 一覧/検索連携 + 回帰テスト
  - PR-B: JSON export/import + バリデーション + 復元UI + 回帰テスト
- [ ] 各PRをマージ前に Android ビルドまで通す（lint / typecheck / test / assemble）

## 1. 期限・通知（PR-A）
- [x] Note モデルへ `dueAt` / `reminderAt` を追加（2026-04-19 実施）
- [x] DB schema / migration を追加（既存データは null 互換、2026-04-19 実施）
- [x] 期限入力UI（作成/編集）を追加（2026-04-19 実施）
- [x] 一覧の期限表示と期限順ソートを追加（2026-04-19 実施）
- [ ] 通知許可状態に応じたガイドUIを追加
- [ ] 通知スケジューラ実装（作成/更新/削除時の再設定含む）
- [ ] 期限・通知関連のユニットテスト追加

## 2. バックアップI/O（PR-B）
- [ ] JSON export 実装（notes / labels / checklist / archive 含む）
- [ ] JSON import 実装（フォーマット検証 + 失敗時エラーメッセージ）
- [ ] 重複データ方針を実装（マージ/上書きの仕様確定）
- [ ] import/export UI導線を設定画面へ追加
- [ ] 壊れたJSON・部分欠損JSONの回帰テスト追加

## 3. リリース準備
- [ ] `npm run lint`
- [ ] `npx tsc --noEmit`
- [ ] `npm test -- --runInBand`
- [ ] Android ビルド（prebuild + assembleRelease）
- [ ] `docs/release-notes-v0.1.6.md` 作成
- [ ] `docs/github-release-v0.1.6.md` 作成
