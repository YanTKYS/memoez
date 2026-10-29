# MemoEZ

シンプルで使いやすい Android 向けメモアプリです。データはデバイス内の SQLite に保存され、オフラインで利用できます（Google Drive バックアップは任意機能です）。

<!-- スクリーンショット
  実際の画像が用意できたら以下のコメントを解除してください。
  <p align="center">
    <img src="docs/screenshots/home.png" width="240" alt="ホーム画面">
    <img src="docs/screenshots/edit.png" width="240" alt="メモ編集画面">
    <img src="docs/screenshots/search.png" width="240" alt="検索画面">
    <img src="docs/screenshots/labels.png" width="240" alt="ラベル管理画面">
  </p>
-->

## 機能一覧

- メモの作成・編集・削除（論理削除 / 物理削除）
- チェックリスト形式のメモ
- ラベルによる分類（多対多）
- メモのピン留め
- カラーによるメモの色分け
- タイトル・本文・チェックリスト・ラベル名を対象とした部分一致検索
- 期限 / リマインドの設定
- ホーム画面の付箋ウィジェット（メモごとに複数配置可。タップするとホーム画面を背後に残したまま、通常と同じ編集画面で編集できる）
- ホーム画面の一覧ウィジェット（4×2。最近のメモをピン留め優先・更新順に最大 50 件表示し、行をタップすると同じ編集画面で編集できる）
- JSON ファイルへのバックアップとインポート
- Google Drive へのバックアップと復元（任意・手動。利用者はアプリ内で Google アカウントに接続するだけで利用可能）
- ダーク / ライトテーマ（端末設定に追従）・一覧レイアウト切り替え（Zustand で永続化）
- 将来のサーバー同期に向けた `serverId` / `syncedAt` カラム対応済み

> Google Cloud Console、OAuth Client ID、SHA-1 などの設定はアプリ開発者・リリース担当者が行います。利用者ごとの設定は不要です。

## 技術スタック

| 分類 | バージョン |
|------|-----------|
| React Native | 0.76.5 |
| Expo SDK | 52 |
| Expo Router | 4（typedRoutes 有効） |
| Drizzle ORM + expo-sqlite | drizzle-orm ^0.38.3 / expo-sqlite ~15.1.0 |
| React Native Paper | ^5.12.5（Material Design 3） |
| Zustand | ^5.0.2 |
| TypeScript | strict mode |
| Jest + jest-expo | ^29.7.0 / ~52.0.0 |

## 必要な開発環境

| ツール | 推奨バージョン |
|--------|--------------|
| Node.js | 22.x |
| npm | 10.x（Node.js 22 同梱） |
| JDK | 17（Temurin 推奨） |
| Android Studio | Ladybug 以降 |
| Android SDK | API 35 / Build-Tools 35.0.0 |
| Android NDK | 26.1.10909125 |

> **注意**: iOS・Web には対応していません。Android 専用アプリです。

## ローカル開発手順

```bash
# 1. リポジトリをクローン
git clone https://github.com/<your-org>/memoez.git
cd memoez

# 2. 依存パッケージをインストール
npm install

# 3. Metro バンドラーを起動
npx expo start

# 4. Android エミュレーターまたは実機で実行
npx expo run:android
```

`expo run:android` は初回実行時に `expo prebuild` を自動で行い、`android/` ディレクトリを生成します。

ウィジェットのネイティブコード（Kotlin・AndroidManifest・リソース）は `modules/memoez-widget/android/` にあり、`expo-modules-autolinking` が自動で取り込みます。ウィンドウ用 Activity は同モジュールの config plugin（`app.json` の `plugins` に登録済み）が prebuild 時にアプリ側へ生成します。生成物である `android/` を直接編集する必要はなく、`expo prebuild --clean` で作り直しても失われません。

開発時に Google Drive バックアップを試す場合のみ、開発者が `.env.example` を `.env` にコピーして Client ID を設定してください（[docs/google-drive-setup.md](docs/google-drive-setup.md)）。Expo Go では動作しません。

### TypeScript チェック

```bash
npx tsc --noEmit
```

### テスト実行

```bash
npm test
```

## APK ビルド手順

### ローカルビルド（デバッグ APK）

```bash
# prebuild で android/ を生成（既存の android/ を上書きする場合は --clean）
npx expo prebuild --platform android --clean

# デバッグ APK をビルド
cd android
./gradlew assembleDebug
```

生成物: `android/app/build/outputs/apk/debug/app-debug.apk`

### ローカルビルド（リリース APK・未署名）

```bash
cd android
./gradlew assembleRelease
```

生成物: `android/app/build/outputs/apk/release/app-release-unsigned.apk`

### CI 経由のビルド・正式配布

PR／main push では、署名 Secrets を使わずテストと debug APK をビルドします。正式配布は別の保護された Workflow です。署名なしの release APK を正式 Release へ添付する経路はありません。

## リリース手順

正式鍵を安全な PC で一度だけ作成・バックアップし、GitHub の署名 Environment と main 保護をオーナーが設定します。オーナーがマージした版の増加・正式ノート・実機確認後、main の確定 SHA と `vX.Y.Z` を指定して手動公開します。PR／main マージ／タグ push だけでは正式公開しません。

詳しくは [署名・安全な公開・旧 debug 版からの移行](docs/releasing.md) と [CI](docs/ci-cd.md) を参照してください。**署名が異なる APK への切替前に、JSON／Google Drive のバックアップと復元を確認してください。バックアップなしのアンインストールは行わないでください。**

## ディレクトリ構造

```
memoez/
├── app/                        # Expo Router ファイルベースルーティング
│   ├── _layout.tsx             # ルートレイアウト（DB初期化・テーマ）
│   ├── index.tsx               # / → (home) へリダイレクト
│   ├── (home)/
│   │   ├── _layout.tsx         # ホーム配下の Stack ナビゲーション
│   │   └── index.tsx           # ホーム画面（メモ一覧）
│   ├── note/[id].tsx           # メモ編集画面
│   ├── note/new.tsx            # 新規メモ作成画面
│   ├── search.tsx              # 検索画面
│   ├── labels.tsx              # ラベル管理画面
│   └── backup.tsx              # バックアップ画面（端末 / Google Drive）
├── index.ts                    # エントリポイント（Expo Router + ウィジェット用ウィンドウを登録）
├── modules/
│   └── memoez-widget/          # ホーム画面ウィジェット（ローカル Expo モジュール / Kotlin）
├── src/
│   ├── domain/                 # 純粋な型・インターフェース（FW依存なし）
│   ├── data/                   # Drizzle 実装・DB・マイグレーション
│   ├── ui/                     # 画面・コンポーネント・hooks・テーマ
│   ├── store/                  # Zustand グローバルストア
│   └── lib/                    # DI・ユーティリティ
├── assets/                     # アイコン・スプラッシュ
├── .github/workflows/          # CI/CD ワークフロー
└── docs/                       # 設計ドキュメント
```

## ドキュメント

| ファイル | 内容 |
|---------|------|
| [docs/architecture.md](docs/architecture.md) | アーキテクチャ概要・レイヤー設計・DI・データフロー |
| [docs/app-icon.md](docs/app-icon.md) | アプリアイコンの SVG 元データ・PNG 再生成・Android 表示確認 |
| [docs/database.md](docs/database.md) | DB設計・テーブル定義・マイグレーション方針 |
| [docs/google-drive-setup.md](docs/google-drive-setup.md) | 開発者向け Google Drive 連携設定（Cloud Console・Client ID・SHA-1・CI） |
| [docs/ci-cd.md](docs/ci-cd.md) | 通常 CI と Expo ビルド設定 |
| [docs/releasing.md](docs/releasing.md) | 正式署名・公開ガード・配布契約・バックアップ移行 |
| [docs/release-note.md](docs/release-note.md) | 全バージョンのリリースノート（新しい順） |
| [docs/release-checklist-v0.4.0.md](docs/release-checklist-v0.4.0.md) | v0.4.0（ウィジェット）の実機確認項目 |
| [docs/release-checklist-v0.5.0.md](docs/release-checklist-v0.5.0.md) | v0.5.0（一覧ウィジェット）の実機確認項目 |
