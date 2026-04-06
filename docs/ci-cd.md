# CI/CD

MemoEZ は GitHub Actions を使って APK のビルドとリリースを自動化しています。

## ワークフロー一覧

| ファイル | トリガー | 生成物 |
|---------|---------|-------|
| `.github/workflows/android-build.yml` | PR・main へのプッシュ | デバッグ APK（Artifacts に 14 日間保存） |
| `.github/workflows/release-signed-apk.yml` | `v*` タグのプッシュ・手動実行 | 署名済みまたは未署名リリース APK（GitHub Release に添付） |

---

## android-build.yml

### トリガー

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```

PR を出したとき、および `main` ブランチへプッシュしたときに自動で実行されます。

### ビルドステップ

1. リポジトリのチェックアウト
2. Node.js 22 のセットアップ
3. `npm ci` で依存パッケージをインストール
4. JDK 17（Temurin）のセットアップ
5. Android NDK 26.1.10909125 のインストール
6. `android/build.gradle` に Kotlin 1.9.25 を強制するパッチを適用
7. `npx expo prebuild --platform android --clean` で `android/` を生成
8. `./gradlew assembleDebug` でデバッグ APK をビルド
9. `app-debug.apk` を Artifacts にアップロード（保持期間: 14 日）

### Kotlin バージョンを強制している背景

Expo SDK 52 が使用する Compose Compiler のバージョン要件により、Kotlin **1.9.25** が必要です。`expo prebuild` が生成する `android/build.gradle` では必ずしも正しいバージョンが設定されないため、ワークフロー内でパッチを当てて強制しています。

```bash
# android/build.gradle の kotlinVersion を 1.9.25 に上書きする例
sed -i 's/kotlinVersion = "[^"]*"/kotlinVersion = "1.9.25"/' android/build.gradle
```

このパッチがないと Compose Compiler の互換性エラーでビルドが失敗します。

---

## release-signed-apk.yml

### トリガー

```yaml
on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:   # 手動実行も可能
```

`v1.0.0` や `v1.2.0-beta` のような `v` プレフィックス付きタグを打つと自動で実行されます。手動実行（`workflow_dispatch`）でも起動できます。

### ビルドステップ

1. リポジトリのチェックアウト
2. Node.js 22 のセットアップ
3. `npm ci`
4. JDK 17（Temurin）のセットアップ
5. Android NDK 26.1.10909125 のインストール
6. `android/build.gradle` への Kotlin 1.9.25 強制パッチ適用
7. `npx expo prebuild --platform android --clean`
8. 署名シークレットの有無を確認
   - **シークレットあり**: キーストアを復元し `assembleRelease` を署名付きで実行
   - **シークレットなし**: `assembleRelease` を未署名で実行
9. APK を GitHub Release に添付
   - `-beta` を含むタグ → プレリリース扱い

### 署名フロー（シークレットあり）

```
ANDROID_KEYSTORE_BASE64
  │  base64 デコード
  ▼
android/app/release.jks として保存
  │
  ▼
gradle.properties に署名情報を書き込み
  │  ANDROID_KEYSTORE_PASSWORD
  │  ANDROID_KEY_ALIAS
  │  ANDROID_KEY_PASSWORD
  ▼
./gradlew assembleRelease
  │
  ▼
app-release.apk（署名済み）→ GitHub Release に添付
```

### リリース方法

```bash
# 通常リリース
git tag v1.0.0
git push origin v1.0.0

# ベータリリース（プレリリース扱い）
git tag v1.0.0-beta
git push origin v1.0.0-beta
```

タグをプッシュするだけで GitHub Release が自動作成され、APK が添付されます。

---

## キーストア作成手順と署名シークレットの設定

### 1. キーストアの作成

Android SDK の `keytool` コマンドでキーストアを生成します。

```bash
keytool -genkey -v \
  -keystore release.jks \
  -alias memoez \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

対話形式でパスワードや組織情報の入力を求められます。入力したパスワードとエイリアス名は後の手順で使います。

> **注意**: `release.jks` はリポジトリに **コミットしないでください**。紛失するとアプリの更新ができなくなるため、安全な場所にバックアップしてください。

### 2. キーストアを Base64 エンコード

```bash
base64 -w 0 release.jks > release.jks.b64
cat release.jks.b64
```

出力された文字列をコピーしておきます。

### 3. GitHub リポジトリにシークレットを登録

GitHub リポジトリの **Settings → Secrets and variables → Actions → New repository secret** から以下の 4 つを登録します。

| シークレット名 | 値 |
|--------------|-----|
| `ANDROID_KEYSTORE_BASE64` | `release.jks.b64` の内容（Base64 文字列） |
| `ANDROID_KEYSTORE_PASSWORD` | キーストア作成時に設定したストアパスワード |
| `ANDROID_KEY_ALIAS` | キー作成時に指定したエイリアス名（例: `memoez`） |
| `ANDROID_KEY_PASSWORD` | キー作成時に設定したキーパスワード |

### 4. 動作確認

シークレット設定後に `v*` タグをプッシュすると、署名済み APK が GitHub Release に添付されます。Actions のログで `Signing config: SIGNED` のような表示が出れば署名が有効です。

### シークレット未設定の場合

`ANDROID_KEYSTORE_BASE64` が未設定の場合は未署名 APK（`app-release-unsigned.apk`）がリリースに添付されます。Google Play には登録できませんが、USB デバッグ有効の実機へ直接インストールして動作確認は可能です。
