# MemoEZ v0.1.6 リリースノート

## 概要
v0.1.6 は「期限・通知」「バックアップI/O」を実利用向けに強化したリリースです。
実機確認で得たフィードバックを反映し、日時入力 UI とバックアップ導線を改善しました。

## 主要変更
1. 期限・通知
   - `dueAt` / `reminderAt` の保存・表示・更新を全体で対応
   - 期限設定 UI を改善（カレンダー日付選択 + 時/分選択）
   - 期限解除・通知ガイド表示を整備
2. バックアップI/O
   - JSON export/import（merge / overwrite）を実装
   - 保存先/読込先フォルダの選択をサポート（初期値: Download）
3. 安定化
   - DB 後方互換 migration
   - リポジトリの soft-delete 安全性向上
   - テスト拡充（backup / scheduler / search / sort / label）

## 実機確認での主な確認項目
- 期限の設定・変更・解除
- カレンダー日付選択と時分選択
- backup export/import（merge / overwrite）
- 既存データからの更新後互換性

## 既知の制限
- OS ネイティブ通知（expo-notifications 連携）は今後の段階で実装予定

## バージョン
- App Version: `0.1.6`
- Target Tag: `v0.1.6`
