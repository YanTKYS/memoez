# Google Drive バックアップのセットアップ

バックアップ画面の「Google Drive」欄を使うための設定です。**任意機能**で、未設定のビルドでも他の機能はそのまま動作し、Google Drive 欄に「設定されていません」と表示されるだけです。

- 認証: [`@react-native-google-signin/google-signin`](https://github.com/react-native-google-signin/google-signin)（Android・Google Play 開発者サービス経由）
- 権限（スコープ）: `https://www.googleapis.com/auth/drive.appdata` のみ
- 保存先: Drive の `appDataFolder` 内の `memoez-backup.json`（マイドライブには表示されない・1 ファイルを上書き）
- **Expo Go では動作しません**。development build（`npx expo run:android`）または APK で確認してください。

## 1. Google Cloud Console の設定

[Google Cloud Console](https://console.cloud.google.com/) で次を行います。

1. プロジェクトを作成（または既存のものを選択）
2. **API とサービス → ライブラリ** で **Google Drive API** を有効化
3. **Google Auth Platform（OAuth 同意画面）** を設定
   - ユーザーの種類: 外部
   - アプリ名・サポートメール等を入力
   - **データアクセス（スコープ）** に `.../auth/drive.appdata` を追加
   - 公開ステータスが「テスト」の間は、**テストユーザー**に使う Google アカウントを登録する必要があります（テスト中は認証が 7 日で失効します）。一般に配布する場合は「本番環境に公開」にします
4. **認証情報 → 認証情報を作成 → OAuth クライアント ID** を次の 2 種類作成
   - **Android**（署名鍵ごとに 1 つ。下表参照）
     - パッケージ名: `com.memoez.app`
     - SHA-1 証明書フィンガープリント: 下記「SHA-1 の取得」参照
   - **ウェブ アプリケーション**（1 つ）
     - 作成後に表示される **クライアント ID** を `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` に設定します（コードには直接書きません）
     - リダイレクト URI などの入力は不要です。クライアント シークレットは使いません

| ビルド | 署名鍵 | Android クライアントの登録 |
|--------|--------|--------------------------|
| ローカル / CI のデバッグ APK | `expo prebuild` が生成する `android/app/debug.keystore` | その SHA-1 |
| リリース APK | [docs/ci-cd.md](ci-cd.md) のリリース用キーストア | その SHA-1 |

> Android クライアント ID はコードに設定しません。Google 側が「パッケージ名 + SHA-1」で端末のアプリを識別します。署名鍵が違うビルド（デバッグとリリース等）は、それぞれ Android クライアントを登録しないと認証が失敗します。

### SHA-1 の取得

```bash
# デバッグ鍵（npx expo prebuild 実行後）
keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android

# リリース鍵（docs/ci-cd.md で作成した release.jks）
keytool -list -v -keystore release.jks -alias memoez
```

出力の `SHA1:` の行を Android クライアントに登録します。Gradle の `./gradlew signingReport`（`android/` で実行）でも確認できます。

## 2. ローカル開発

```bash
cp .env.example .env        # .env は git 管理外
# .env の EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID にウェブ クライアント ID を設定

npx expo run:android        # development build（Expo Go は不可）
```

`EXPO_PUBLIC_` 変数はバンドル時に埋め込まれます。値を変えたら `npx expo start -c` でキャッシュを消して再起動してください。

## 3. GitHub Actions / リリースビルド

ウェブ クライアント ID は秘密情報ではないため、**Repository variable** として登録します。

**Settings → Secrets and variables → Actions → Variables → New repository variable**

| 変数名 | 値 |
|--------|-----|
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | ウェブ アプリケーションの OAuth クライアント ID |

ワークフロー（`android-build.yml` / `release-signed-apk.yml`）の APK ビルドステップが、この変数を環境変数として渡します。未登録でもビルドは通り、Google Drive 連携だけが無効になります。

リリース APK は `release-signed-apk.yml` が署名するため、**そのキーストアの SHA-1 を Android クライアントに登録**してください（上表）。

## 4. 動作の仕様

- バックアップは既存の JSON バックアップ（`exportBackupJson`）と同一形式です。復元も既存のインポート処理（`importBackupJson`）を使うため、形式検証と merge / overwrite の挙動はファイルからの復元と同じです。
- 復元方法（merge / overwrite）はバックアップ画面上部の選択に従います。
- 「最終バックアップ」は Drive 上のファイル更新日時です（オフライン時は取得できず「なし」と表示されます）。
- 接続解除はアプリに与えた権限を取り消しますが、Drive 上の `memoez-backup.json` は削除しません。不要な場合は Google ドライブの「設定 → アプリの管理」から MemoEZ の非表示データを削除できます。

## トラブルシューティング

| 症状 | 原因の例 |
|------|---------|
| 接続時にエラーになる（ログに `DEVELOPER_ERROR` / code 10） | Android クライアントのパッケージ名・SHA-1 が、実際にインストールしたビルドの署名鍵と一致していない |
| 同意画面で「アクセスをブロック」と出る | 公開ステータスが「テスト」で、そのアカウントがテストユーザーに未登録 |
| 数日後に再接続を求められる | 公開ステータスが「テスト」（認証が 7 日で失効する） |
| 画面に「設定されていません」と出る | ビルド時に `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` が空だった |

デバッグ情報（HTTP ステータス等）は画面には出さず、`[GoogleDrive]` プレフィックスで logcat に出力します。

```bash
adb logcat *:S ReactNativeJS:V | grep GoogleDrive
```
