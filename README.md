# MemoEZ

シンプルで使いやすい Android 向けメモアプリです。オフライン専用で、すべてのデータはデバイス内の SQLite に保存されます。

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
- 全文検索（SQLite FTS5）
- ダーク / ライトテーマ切り替え（Zustand で永続化）
- 将来のサーバー同期に向けた `serverId` / `syncedAt` カラム対応済み

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

### CI 経由のビルド（GitHub Actions）

- **PR / main へのプッシュ**: デバッグ APK が自動でビルドされ、Actions の Artifacts に 14 日間保存されます。
- **`v*` タグのプッシュ**: 署名済みリリース APK がビルドされ、GitHub Release に添付されます。

詳細は [docs/ci-cd.md](docs/ci-cd.md) を参照してください。

## リリース手順

```bash
# バージョンタグを打つだけでリリースが自動作成されます
git tag v1.2.0
git push origin v1.2.0

# ベータリリースの場合
git tag v1.2.0-beta
git push origin v1.2.0-beta
```

- 署名シークレット（`ANDROID_KEYSTORE_BASE64` 等）が設定済みの場合 → 署名済み APK を GitHub Release に添付
- 署名シークレット未設定の場合 → 未署名 APK を GitHub Release に添付（実機テスト用）
- `-beta` を含むタグ → プレリリース扱い

詳細な署名設定手順は [docs/ci-cd.md](docs/ci-cd.md) を参照してください。

## ディレクトリ構造

```
memoez/
├── app/                        # Expo Router ファイルベースルーティング
│   ├── _layout.tsx             # ルートレイアウト（DB初期化・テーマ）
│   ├── index.tsx               # / → (home) へリダイレクト
│   ├── (home)/
│   │   ├── _layout.tsx         # BottomTab ナビゲーション
│   │   └── index.tsx           # ホーム画面（メモ一覧）
│   ├── note/[id].tsx           # メモ編集画面
│   ├── note/new.tsx            # 新規メモ作成画面
│   ├── search.tsx              # 検索画面
│   └── labels.tsx              # ラベル管理画面
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
| [docs/database.md](docs/database.md) | DB設計・テーブル定義・マイグレーション方針 |
| [docs/ci-cd.md](docs/ci-cd.md) | CI/CD ワークフロー・署名設定手順 |
