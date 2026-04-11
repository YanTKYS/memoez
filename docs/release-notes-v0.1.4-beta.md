# MemoEZ v0.1.4-beta リリースノート（ドラフト）

## 主要変更点
1. Android CI の安定化（Kotlin/Gradle 周りの設定見直し、失敗ログ改善）。
2. ノートのソフト削除運用を強化（削除済みデータへの更新を防止）。
3. ラベルの一意性を DB レベルで強化（有効ラベル名の重複防止）。
4. ノート削除時の UI エラーハンドリングを改善（失敗時に通知表示）。
5. リリース運用ドキュメント（v0.1.4-beta チェックリスト）を追加。

## 既知の制限事項
- Android ビルド環境により Gradle 実行時間のばらつきが大きい。
- CI では Kotlin Gradle Plugin の構成チェックタスクを除外してビルド継続性を優先している。

## マイグレーション / 互換性
- アプリバージョン: `0.1.4-beta`
- Android `versionCode`: `4`
- DB では `labels(name)` に「`deleted_at IS NULL` 条件付きユニークインデックス」を適用済み。


## リリース作業メモ（2026-04-11）
- `npm run lint` は 2026-04-11 実行時に `@eslint/eslintrc` / `ajv` 初期化エラーで失敗。
- `npx expo prebuild --platform android --no-install` は `npm view expo-template-bare-minimum@sdk-52 dist --json` の registry 403 失敗で中断。
- そのため、実機テスト前に Android ローカル release ビルド確認の再実行が必要。


### 実機テスト開始条件
- `android/` 生成 (`expo prebuild`) が成功していること。
- `app-release-unsigned.apk` 生成を確認してから実機テストに進むこと。
