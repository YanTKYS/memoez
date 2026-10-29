# 正式署名 APK の公開・更新

この文書はオーナー／公開担当者向け。**本基盤の PR・CI・main マージだけではタグ／正式 Release を作らない。** 初回設定と実機検証を終え、オーナーが公開方針を承認するまで `MEMOEZ_RELEASE_ENABLED` を設定しない。署名鍵やパスワードを ChatGPT・PR・ログへ渡さない。

## 公開契約

- applicationId は `com.memoez.app` のまま。正本は `app.json` の `expo.version` と `expo.android.versionCode`。`package.json` の version も同じ版に更新する。正式タグは厳密な `vX.Y.Z`（beta 等は本経路では拒否）。
- `versionName` と `versionCode` は、過去の正式公開版から両方増やす。初回基準は既存 v0.5.0 / code 8（`tools/release-policy.json`）。本 PR はバージョンを上げず、現在の v0.5.0 を再公開しない。
- 同じ鍵を使い続ける。リリースごとの鍵生成・自動的な証明書ローテーションは禁止。v0.5.0 以前の Releases が正式な同一鍵だったとは仮定しない。既存 APK の証明書と手元の鍵をオーナーが確認し、異なる場合は下記の初回移行を行う。
- Releases の正式資産は **3 個だけ**：`memoez-vX.Y.Z.apk`、`memoez-vX.Y.Z.apk.sha256`、`memoez-vX.Y.Z.json`。資産名を固定し、unsigned／debug APK は混ぜない。
- `.apk.sha256` は SHA-256＋空白2個＋APKファイル名＋改行。JSON の schemaVersion は 1、`applicationId`、`versionName`、`versionCode`、`commit`、`certificateSha256`、`apkSha256`、`apkAsset` を持つ。次のアプリ内更新機能は stable・非 draft の Release だけを選び、JSON と APK のバージョン・証明書・ハッシュを照合する。インストーラーの署名検証を省略しない。
- v0.5.0 より後の公開版には、この JSON が必須。欠落・不整合・証明書変更・増加しない code は公開停止。最新の正式版は APK 自体を再取得して署名・実際の versionCode と JSON の一致を確認し、JSON の申告だけを信用しない。過去の資産やタグを自動上書きしない。

## 初回設定（オーナーが行う／この PR では未設定）

1. main の Ruleset／ブランチ保護で PR 必須・レビュー・Android Build を必須にし、force push／削除を禁止。管理者の迂回も制限する。タグ `v*` の変更・削除・未承認作成も保護する。実行時にも main の `protected` を確認するが、適切なレビュー要件まではコードだけでは保証できない。
2. Environment **release-signing** を作り、deployment branch policy は **branch の main 1件のみ**にする（全保護ブランチ、ワイルドカード、tag は不可）。Required reviewers を必ず設定。自己レビュー禁止を使う場合、dispatch するオーナー以外の承認担当者も用意する。Environment の管理者バイパスは無効にする。
3. 鍵は自分の安全な PC で一度だけ作り、別媒体へ暗号化バックアップする。既存の正式鍵がある場合は新規生成しない。以下は**オーナーの PC 用**であり、CI／このクラウドでは正式鍵を生成しない。

```sh
# 例：リポジトリの外で実行。パスワードは対話入力する。
keytool -genkeypair -storetype JKS -keyalg RSA -keysize 4096 -validity 10000 \
  -alias memoez -keystore /safe/private/location/memoez-release.jks
keytool -list -v -keystore /safe/private/location/memoez-release.jks -alias memoez
```

証明書の名前・SHA-1／SHA-256 は公開情報。証明書の個人名等には公開してよい値を使う。秘密鍵は公開しない。バックアップ鍵を別の安全な環境で読み出し、同じ証明書であることを確認する。紛失すると通常の上書き更新ができない。

4. **Environment Secrets だけ**に次を登録する。同名の Repository／Organization Secrets があれば、オーナーが移行後に削除して PR／任意ブランチから鍵へアクセスできないようにする。base64 は暗号化ではない。チャットや `cat` で表示せず、安全な PC から GitHub の設定画面／CLI へ直接入力する。

| release-signing の Secret | 内容 |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | 同じ release keystore の改行なし base64 |
| `ANDROID_KEYSTORE_PASSWORD` | store password |
| `ANDROID_KEY_ALIAS` | alias |
| `ANDROID_KEY_PASSWORD` | key password |

5. **Repository Variables** に `MEMOEZ_RELEASE_CERT_SHA256`（上記公開証明書の SHA-256、コロン可）を登録。初回テストと実機確認後にのみ `MEMOEZ_RELEASE_ENABLED=true` を設定する。これらは公開可能な値。Google Drive を含む正式版には `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` も設定し、正式証明書の SHA-1 を Google Cloud の Android OAuth クライアント（package=`com.memoez.app`）に追加する。[Drive 設定](google-drive-setup.md)を参照。

Environment Secrets がなくても通常 PR/main CI は動く。署名ステップで4項目のどれかが不足すれば失敗し、unsigned へのフォールバックはしない。値をログやコマンド引数のパスワードへ展開せず、apksigner の `env:` パスワード入力を使う。鍵は runner の一時領域へ mode 600 で復号し、成功・失敗とも削除する。署名ジョブには contents:write を与えず、署名用キャッシュや秘密情報の Artifacts を作らない。

## 正式公開手順

1. リリース PR に app.json の増加した version/code、`docs/release-note.md` の**ドラフトではない** `## vX.Y.Z` 節、`### Title`（`vX.Y.Z:` で開始）と `### Note`、実機検証記録を揃える。既存の過去ノートは消さない。
2. ChatGPT 等によるレビュー後、オーナー **YanTKYS** が main へマージする。既存の自動マージ処理にリリース PR を渡さない（必要ならオーナーが自動マージ Workflow を停止）。bot がマージした SHA は公開ガードに拒否される。
3. main の最新 HEAD の40桁 SHA を確認し、オーナーが Actions → **Release Signed APK** → Run workflow → **main** を選び、tag=`vX.Y.Z` と commit=その SHA を入力する。入力タグはこの時点では未作成である必要がある。main が先に進んだ古い SHA は拒否する。通常の main push／PR／tag push は公開経路ではない。
4. plan はオーナー操作（再実行者も照合）・オーナーマージ・main 保護・署名 Environment の制限／承認設定・版の増加・確定ノート・既存タグ／Release（非公開 Draft 含む）との非衝突を確認する。
5. build は Secrets なしでテスト・clean prebuild・unsigned release を生成。署名ジョブは Environment 承認後にだけ鍵を受け取り、署名後に証明書固定値・package・version・non-debuggable を検証する。
6. publish は署名鍵なし・contents:write の別ジョブ。全ガードを再確認し、新しいタグと**この実行専用の一時的な非公開 Draft**を作る。3資産を添付→再ダウンロードして SHA・署名・メタデータを検証→main の承認根拠とタグの不変を再確認→最後に正式公開する。既存 Draft の流用や prerelease の正式化は行わない。
7. Workflow Summary の正式 URL を確認する。必要ならダウンロード後、以下で公開物を再検証する。署名情報を含み得るビルドには `--info`／`--debug`／`--scan` を付けない。

```sh
sha256sum -c memoez-vX.Y.Z.apk.sha256
"$ANDROID_HOME/build-tools/35.0.0/apksigner" verify --verbose --print-certs memoez-vX.Y.Z.apk
"$ANDROID_HOME/build-tools/35.0.0/aapt2" dump badging memoez-vX.Y.Z.apk
```

APK の SHA-256 はファイルの一致、証明書 SHA-256 は継続更新の同じ鍵を確認する値で、別物。

## 失敗・重複時

公開経路は固定 concurrency で直列化し、進行中の run を自動キャンセルしない。既存タグ／Release／Draft があれば同じ commit でも停止する。既存資産の `--clobber`、タグの付け替え、既存 Draft の自動公開は行わない。

- タグ作成前の失敗：設定・アクセス・署名・ビルドを修復し、同じ承認済み HEAD の run を再実行できる。
- タグや内部 Draft が残った失敗：オーナーが commit・証明書・資産と失敗段階を調査する。再実行は安全のため拒否される。自動削除せず、新しい増加版を PR で準備するか、オーナーが未公開物の扱いを判断する。既存 Draft の手動公開で検証を迂回しない。
- 正式公開後：同じ版を再作成・置換しない。修正版は新しい version/code にする。

## 旧 debug 版からの移行（実機未確認）

**署名が違う debug APK → release APK は通常上書きできない。バックアップ未確認のアンインストールは行わない。**

1. 旧アプリを残したまま、JSON を端末外（PC 等）にもコピーする。Google Drive も利用している場合は接続して手動バックアップを成功させ、アカウント・日時を控える。
2. 別テスト端末の正式署名候補 APK で JSON の読み込み／復元を確認する。メモ件数・本文・チェックリスト・ラベル・色・ピン留め・期限を照合する。Drive も別テスト端末で正しい Google アカウントへ接続し、復元確認する。settings／ホームのウィジェット配置は JSON に含まれると仮定せず、設定値を別途控える。
3. バックアップと復元の両方が確認できてから、オーナーが元端末の切替を判断する。署名違いなら旧版削除後に正式版を導入し、退避済みデータを復元する。アンインストールは SQLite・アプリ設定・ウィジェット配置を消す可能性がある。2×2／4×2 は必要に応じて再配置し表示・編集・一覧更新を確認する。
4. 元データ／JSON は移行後の照合完了まで保持する。Drive の接続や復元に失敗した場合、旧アプリと退避データを保持し、署名 SHA-1・package の OAuth 登録を確認する。データ消去で解決しようとしない。

## 同じ署名 release 間の更新（実機未確認）

前版でメモ・チェックリスト・ラベル・期限・設定と2種のウィジェットを用意し、JSON を端末外にも保存する。後続の候補 APK が同じ applicationId／証明書で、versionCode が増えていることを検証して `adb install -r next-release.apk` を実行する。SQLite の全データ、設定、ウィジェット表示・編集、JSON の書き出し／復元、Google Sign-In と Drive のバックアップ／復元が維持されることを確認する。`adb uninstall` や `-d` による版下げを更新テストの代用にしない。

正式鍵・Secrets 設定、別媒体バックアップ読み出し、正式鍵での2回の署名と同一証明書確認、実機上書き／移行／Drive 認証はオーナーの作業であり、テスト鍵の自動検証をこれらの完了扱いにしない。

## 基盤の検証記録（正式公開の承認ではない）

- 公開ガードの Python テスト23件、Jest 26スイート／128件、TypeScript、Lint、Android `lintDebug`、変更した Workflow の actionlint が成功。
- config plugin による clean prebuild 後、生成物への手修正なしで `:app:assembleRelease :app:assembleDebug` が成功。release は `app-release-unsigned.apk`、debug は従来の debug 署名。
- 一時的な検証専用鍵で unsigned release を2回署名し、証明書・package・version・non-debuggable・3資産を検証。unsigned／別証明書／debuggable／改変 APK を拒否することを実物で確認した。v4 増分インストール用 `.idsig` は単体配布では生成しない。テスト鍵と署名済みテスト資産は削除済み。
- 再実行手順（正式鍵は不要）：

```sh
python3 -m unittest discover -s tools/tests -v
npx tsc --noEmit
npm test -- --runInBand
npx expo prebuild --platform android --clean --no-install
(cd android && ./gradlew :app:assembleRelease :app:assembleDebug -x checkKotlinGradlePluginConfigurationErrors --no-configuration-cache --no-daemon --max-workers=2)
# JDK 17 と ANDROID_HOME / Build-Tools 35.0.0 が必要。
python3 tools/tests/signing_smoke.py
```

`signing_smoke.py` は新しい一時テスト鍵を作るが、正式鍵として保存／使用しない。GitHub API、タグ作成、Release 作成を呼ばない。

今回の読み取り時、main は `protected=false`、署名 Environment は未作成だった。Secrets／Variables 名の API は403で取得できず、既存値の有無は未確認。設定の変更・正式鍵の生成／取得・正式タグ／Release の作成は実施していない。正式鍵による再現署名、鍵バックアップの復旧確認、実機の移行／継続更新／2種ウィジェット／Drive 認証、GitHub 上の Environment 承認から実際の公開までの通し確認はオーナー作業として残る。
