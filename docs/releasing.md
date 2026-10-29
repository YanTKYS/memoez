# 正式署名 APK の公開・更新

この文書はオーナー／公開担当者向け。**レビュー済み PR をオーナーが main にマージしたことを、新版の正式公開承認とする。** 同版の通常 PR は `skip`、新しい安定版だけが自動公開候補になる。手動 workflow_dispatch・タグ／SHA 入力・毎回の Environment 追加承認は使わない。 初回設定と実機検証を終え、オーナーが公開方針を承認するまで `MEMOEZ_RELEASE_ENABLED` を設定しない。署名鍵やパスワードを ChatGPT・PR・ログへ渡さない。

## 公開契約

- applicationId は `com.memoez.app` のまま。正本は `app.json` の `expo.version` と `expo.android.versionCode`。`package.json` の version も同じ版に更新する。正式タグは厳密な `vX.Y.Z`（beta 等は本経路では拒否）。
- `versionName` と `versionCode` は、過去の正式公開版から両方増やす。初回基準は既存 v0.5.0 / code 8（`tools/release-policy.json`）。本 PR はバージョンを上げず、現在の v0.5.0 を再公開しない。
- 同じ鍵を使い続ける。リリースごとの鍵生成・自動的な証明書ローテーションは禁止。v0.5.0 以前の Releases が正式な同一鍵だったとは仮定しない。既存 APK の証明書と手元の鍵をオーナーが確認し、異なる場合は下記の初回移行を行う。
- Releases の正式資産は **3 個だけ**：`memoez-vX.Y.Z.apk`、`memoez-vX.Y.Z.apk.sha256`、`memoez-vX.Y.Z.json`。資産名を固定し、unsigned／debug APK は混ぜない。
- `.apk.sha256` は SHA-256＋空白2個＋APKファイル名＋改行。JSON の schemaVersion は 1、`applicationId`、`versionName`、`versionCode`、`commit`、`certificateSha256`、`apkSha256`、`apkAsset` を持つ。次のアプリ内更新機能は stable・非 draft の Release だけを選び、JSON と APK のバージョン・証明書・ハッシュを照合する。インストーラーの署名検証を省略しない。
- v0.5.0 より後の公開版には、この JSON が必須。欠落・不整合・証明書変更・増加しない code は公開停止。最新の正式版は APK 自体を再取得して署名・実際の versionCode と JSON の一致を確認し、JSON の申告だけを信用しない。過去の資産やタグを自動上書きしない。

## 初回設定（オーナーが行う／この PR では未設定）

1. main の Ruleset／ブランチ保護で **PR 必須・Android Build 必須**を有効にし、force push／削除／直接 push と Roles・管理者によるバイパスを制限する。個人開発では Required approvals は **0** とし、ChatGPT がチャット／PR コメントでレビューした内容をオーナーが確認して、自分の PR も自分でマージできる構成にする。タグ `v*` の変更・削除・未承認作成も保護する。コードは main の `protected` と API 上の正当なオーナーマージ・PR 対応を確認するが、チャットのレビュー内容や Ruleset の全 Roles・例外・バイパス設定を機械的に証明するわけではない。管理者による Workflow／保護設定／Secrets の変更を防ぐ境界は GitHub 側の権限管理である。

   組織運用へ移行して別アカウントの正式承認が必要になった場合だけ、Required approvals、stale 承認破棄、最新 push の承認、Code Owners 等を GitHub 側で任意に追加する。これは現在の自動公開の必須条件ではなく、release.py は独立した APPROVED を重ねて要求しない。

2. Environment **release-signing** を作り、deployment branch policy は **branch の main 1件のみ**にする（全保護ブランチ、ワイルドカード、tag は不可）。Environment の Required reviewers は設定しない（既存設定は一度だけ外す）。毎回の公開承認は main の PR レビューとオーナーマージに集約する。追加 reviewers が残っていれば plan は停止する。Environment Secrets は main 限定を保ち、PR／任意ブランチでは使わせない。
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

## 通常の自動公開

1. リリース PR に app.json／package.json の新しい安定版、増加した versionCode、`docs/release-note.md` の**ドラフトではない** `## vX.Y.Z` 節と `### Title`（`vX.Y.Z:` 開始）／`### Note`、実機検証記録を揃える。既存の過去ノートは消さない。
2. ChatGPT がチャット／PR コメントでレビューし、オーナー **YanTKYS** が内容と CI を確認して保護された main へ PR をマージする。API で確認できるこのオーナーマージが公開の最終承認であり、別アカウントの GitHub APPROVED は不要。自分で作成した PR も同じ条件で扱う。既存の自動マージ処理にリリース PR を渡さない（必要なら一度だけオーナーがその Workflow を停止）。bot 等のマージからは正式公開しない。
3. main push で Workflow を自動起動。秘密鍵なしの軽量 plan が app.json／package.json と既存の正式版を照合する。同じ versionName／versionCode は `skip` で正常終了し、SDK 導入・release ビルド・署名・公開ジョブを実行しない。初回の公開無効フラグも `skip`。v0.5.0/code8 のこの PR マージでは公開せず、最初の公開は次の安定版とする。
4. 新版は、main が保護されていること、起動 SHA が現在の main HEAD と一致すること、GitHub API が示す PR の merge_commit_sha／merged_by／base と before-after を検証する。正式な Review が0件でも正当なオーナーマージなら受け付ける。チャット／コメントを APPROVED に読み替えたり、その文面を自動判定したりはしない。PR／tag／手動イベント、main の作成・削除・強制 push、直接 push は公開根拠にせず、bot・非オーナーのマージも拒否する。
5. merge は親が `[push.before, PR.head.sha]` と一致すること、squash／単一コミット rebase は1親が push.before であることを検証する。GitHub API の merge_commit_sha はそれぞれ merge commit／squash commit／rebase 後の最終 commit を指す。複数コミット rebase は before→after の完全な1親チェーン・PR のコミット数・元 PR head を照合し、元の各変更と rebased commit の `git patch-id --stable` の一致も検証する。250件超、欠けた API 応答、空または取得不能な diff は拒否する。証跡を確かめられない場合は merge／squash を使う。
6. Environment は main 1件限定を必須とし、追加 Required reviewers がないことを確認する。版の増加、確定ノート、既存タグ／Release／Draft の非衝突、証明書固定値を確認。候補だけ SDK を用意し、最新正式 APK の署名と実際の code を再検証する。README 等の同版 PR にこの高コストな検証は走らない。
7. build は Secrets なしでテスト・clean prebuild・unsigned release を生成。sign は main 限定 Environment の鍵だけを受け取り、署名後に証明書固定値・package・version・non-debuggable・3資産を検証する。追加の人手承認は待たない。
8. 鍵を持たない publish ジョブが全ガードを再確認し、新規タグと**その実行専用の内部非公開 Draft**を作成。3資産を添付→再ダウンロード→署名・SHA・メタデータと GitHub digest を再検証→main のオーナーマージ・PR 対応とタグの不変を再確認→最後に正式公開する。既存 Draft の流用や prerelease の正式化はしない。
9. Summary の `release`（候補）、`skip`、失敗時の `failed` と最終正式 URL を確認する。通常運用でタグ作成・SHA 入力・Environment 承認操作は不要。必要なら公開物を以下で再検証する。署名情報を含み得るビルドには `--info`／`--debug`／`--scan` を付けない。

```sh
sha256sum -c memoez-vX.Y.Z.apk.sha256
"$ANDROID_HOME/build-tools/35.0.0/apksigner" verify --verbose --print-certs memoez-vX.Y.Z.apk
"$ANDROID_HOME/build-tools/35.0.0/aapt2" dump badging memoez-vX.Y.Z.apk
```

APK の SHA-256 はファイルの一致、証明書 SHA-256 は継続更新の同じ鍵を確認する値で、別物。

## 失敗・重複時

公開経路は固定 concurrency で直列化し、進行中の run を自動キャンセルしない。公開済みの同版・同 code の後続 PR／成功済み run の再実行は `skip` となり再公開しない。既存の未公開タグ／Draft、同名で異なる code、巻き戻しは停止する。既存資産の `--clobber`、タグの付け替え、Draft の自動流用はしない。

- タグ作成前の失敗：設定／アクセス／署名／ビルドを修復し、GitHub 上で失敗した元の push run を再実行できる。新しい手動 dispatch やタグ／SHA 入力は不要。再実行者を公開承認とはせず、元のオーナーマージ・PR 対応の証跡、保護された現在の main HEAD を再検証する。main が先に進んだ元 run は公開しない。
- タグや内部 Draft が残った失敗：通常の run を再実行しても停止し、既存物を削除／再公開しない。オーナーが commit・証明書・資産と失敗段階を調査し、未公開物を残したまま次の増加版の PR を準備するか、未公開物の扱いを例外的に判断する。中途半端な Draft を手動公開して検証を迂回しない。
- 公開後：同版は正常 skip。修正は新しい版／code の PR をレビューしてオーナーがマージするだけで、新版の自動公開へ進む。

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

- 公開ガードの Python テスト32件、Jest 26スイート／128件、TypeScript、Lint、Android `lintDebug`、変更した Workflow の actionlint が成功。
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

今回の読み取り時、main は `protected=false`、署名 Environment は未作成だった。Secrets／Variables 名の API は403で取得できず、既存値の有無は未確認。設定の変更・正式鍵の生成／取得・正式タグ／Release の作成は実施していない。正式鍵による再現署名、鍵バックアップの復旧確認、実機の移行／継続更新／2種ウィジェット／Drive 認証、GitHub 上のオーナーマージから実際の自動公開までの通し確認はオーナー作業として残る。

追加方針に合わせ、owner workflow_dispatch／GITHUB_TRIGGERING_ACTOR／Environment reviewers の承認要件は廃止した。マージ方法別の API 証跡、新版 release／同版 skip、強制／直接 push・非オーナーマージ・不正な PR 対応・古い SHA・不正な版／ノート／設定の拒否を単体検証している。実際の main 保護設定はオーナーが行い、未設定を許す緩和はしていない。

再レビューに対応し、独立した GitHub APPROVED の必須判定と Review API 呼び出しを除去した。正式 Review 0件・オーナー自身が作成した PR のオーナーマージを受け付け、非保護 main・非オーナー／bot マージ・直接 push 等の拒否は維持している。署名・配布の検証には変更なし。
