# MemoEZ v0.1.5 リリースチェックリスト（リファクタリング版）

最終更新: 2026-04-18

## リリース管理情報
- [ ] リリースオーナー:
- [ ] レビュー担当:
- [ ] 予定リリース日:
- [ ] 対象タグ: `v0.1.5`
- [ ] 対象コミットSHA:

## 0. 方針
- [x] v0.1.5 のテーマを「将来アップデートに備えたリファクタリング」とする
- [ ] 影響範囲（UI hooks / repository / search / test）を PR 単位に分割
- [ ] 各 PR で回帰テストを実施

## 1. バージョン更新
- [x] `app.json` の `expo.version` を `0.1.5` に更新（2026-04-18 実施）
- [x] `app.json` の `android.versionCode` を `6` に更新（2026-04-18 実施）
- [x] `package.json` の `version` を `0.1.5` に更新（2026-04-18 実施）
- [x] `package-lock.json` の `version` と root package version が `0.1.5` で一致（2026-04-18 実施）

## 2. リファクタリング実行チェック
- [ ] `useEditNote` の責務分割
- [ ] `DrizzleNoteRepository` の helper 分割
- [ ] `useSearch` の条件分岐整理
- [ ] hooks/repository の追加テスト

## 3. リリース準備
- [ ] `npm run lint`
- [ ] `npx tsc --noEmit`
- [ ] `npm test -- --runInBand`
- [ ] Android ビルド（prebuild + assembleRelease）
