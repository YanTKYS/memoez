# MemoEZ v0.1.4-beta リリースチェックリスト

最終更新: 2026-04-11

## リリース管理情報
- [ ] リリースオーナー:
- [ ] レビュー担当:
- [ ] 予定リリース日:
- [ ] 対象タグ: `v0.1.4-beta`
- [ ] 対象コミットSHA:

## 0. リリース方針
- [x] リリース対象ブランチが `main` にマージ済み（2026-04-09 確認済み）
- [ ] 対象PRがすべて green（Android Build / テスト / lint）
- [ ] リリース担当者を明確化（実行者1名、レビュアー1名）

## 1. バージョン更新
- [x] `app.json` の `expo.version` を `0.1.4-beta` に更新（2026-04-11 実施）
- [x] `app.json` の `android.versionCode` を `4` に更新（2026-04-11 実施）
- [x] `package.json` の `version` を `0.1.4-beta` に更新（2026-04-11 実施）
- [x] `package-lock.json` の `version` と root package version が `0.1.4-beta` で一致（2026-04-11 実施）

## 2. ローカル事前確認（必須）
- [x] 依存関係インストール
  - [x] `npm install --no-audit --no-fund`（2026-04-09 実施）
- [x] 型チェック
  - [x] `npx tsc --noEmit`（2026-04-10 実施）
- [x] テスト
  - [x] `npm test -- --runInBand`（2026-04-10 実施）
- [x] lint
  - [x] `npm run lint`（2026-04-11 再実施 / warningのみ）

## 3. Android ビルド確認
- [x] `npx expo prebuild --platform android --no-install`（2026-04-11 ビルド成功時点で完了）
- [x] `cd android && ./gradlew assembleRelease -x checkKotlinGradlePluginConfigurationErrors --no-configuration-cache --no-daemon`（2026-04-11 ビルド成功）
- [x] 生成物確認
  - [x] `android/app/build/outputs/apk/release/app-release-unsigned.apk` が存在（2026-04-11 確認）


## 実機テスト前ブロッカー（2026-04-11 時点）
- ブロッカーは解消済み。ローカルAPKビルド成功により、実機テスト開始可能。

## 4. GitHub Actions リリース実行
- [x] `main` に push 後、`Android Build` ワークフローが成功（2026-04-09 確認済み）
- [ ] タグ作成: `v0.1.4-beta`
- [ ] `Release Signed APK` ワークフローが成功
- [ ] GitHub Release に APK が添付されている
- [ ] `PR Auto Merge and Delete Branch` が有効で、競合なしPRが自動マージされる

## 5. リリースノート
- [x] 主要変更点を 3–7項目で整理
- [x] 既知の制限事項（もしあれば）を記載
- [x] マイグレーション/互換性注意点を記載

## 6. リリース後確認
- [ ] 実機インストール確認（起動・メモ作成・編集・削除・検索）
- [ ] ラベル操作確認（作成/編集/削除）
- [ ] SQLite 既存データが壊れていないことを確認
- [ ] クラッシュ/重大エラーがないことを確認
- [ ] 監視対象（クラッシュ率/ANR/重要ログ）を24時間確認

## 7. Go / No-Go 判定
- [ ] Go 判定会議を実施
- [ ] No-Go 条件（重大障害・署名失敗・データ破損）に該当しない
- [ ] Goの場合のみ本番告知を実施

## 8. ロールバック手順（簡易）
- [ ] 必要時は直前の安定タグ（`v0.1.3`）に復帰
- [ ] 問題PRを revert し hotfix ブランチ作成
- [ ] 再ビルド後、`v0.1.4-beta-hotfix.1` などで再リリース
