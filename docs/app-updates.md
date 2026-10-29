# アプリ内の更新確認（v0.6.0 / code9）

ホームの「設定」から「アプリについて／更新」を開く。「バックアップ」（JSON／Google Drive）も設定の先頭に置き、ホームのボタン数は増やしていない。レイアウト切替・検索・ラベル・メモ編集・SQLite・バックアップ形式・2×2／4×2ウィジェットの動作コードは変更しない。

## 利用者の操作

1. インストール済みの版は Android PackageInfo から表示する。app.json の値を実インストール版の代用にしない。
2. 「最新版を確認」を押したときだけ GitHub の正式 latest Release を照会する。起動・画面表示・復帰時の自動照会や、自動取得・常駐監視はしない。
3. 同版・旧版・未公開・旧契約（v0.5.0以前）・資産不備・通信／利用制限は区別して表示する。対応する新版があり、インストール済みアプリと証明書が一致するときだけ更新ボタンが出る。debuggable な debug 版はアプリ内更新の対象外。
4. 明示的な「更新する」で取得する。進捗を表示し「取得を中断」で取消可能。画面を閉じたりアプリがバックグラウンドへ移る場合も通信を中断する。検証失敗はインストーラーへ渡さない。
5. Android 8+ で未許可なら「この提供元からのインストール設定」を押し、Android の設定で許可する。戻るだけではインストーラーを起動しない。「Android の確認画面を開く」を押し、Android 標準の画面で最終承認する。許可の自動承認・無断インストールはしない。
6. 更新できなくてもアプリやデータを削除しない。GitHub Release／リリースノートを開く導線と、JSON／Drive のバックアップ導線を残す。

デバッグ版と正式鍵の APK は原則上書き不可。署名違いは取得前に更新不可にし、迂回しない。[正式署名・初回移行](releasing.md)に従って、旧アプリを残したまま端末外への JSON 退避と別端末での復元を確認する。バックアップ未確認のアンインストールやデータ消去を促さない。

## 実装と防御境界

- `modules/memoez-updates` は独立したローカル Expo Module。expo-modules-autolinking が取り込み、clean prebuild 後も library manifest の権限・専用 FileProvider が再現される。既存ウィジェットの Activity／Provider や Google Sign-In と共有しない。
- `REQUEST_INSTALL_PACKAGES` を追加。外部ストレージ権限・QUERY_ALL_PACKAGES・バックグラウンドサービスは追加しない。API 26未満では従来の Android インストーラーの許可動作に委ねる。
- 初期 URL は `GET https://api.github.com/repos/YanTKYS/memoez/releases/latest` と、その応答の安定版 `vX.Y.Z` から組み立てた同リポジトリの固定名3資産だけ。Draft／prerelease・型違い・重複／不足資産・別リポジトリ・不正な URL は拒否する。JS から任意 URL／ファイルパスを渡す API はない。
- 資産は [配布契約](releasing.md) の `memoez-vX.Y.Z.apk`、`.apk.sha256`、`.json`。JSON の版／code／package／証明書／APK 名と SHA-256、チェックサムの対象名、存在する GitHub asset digest を照合する。
- HTTPS の証明書・ホスト検証は標準のまま。API リダイレクトは拒否。資産は最大3回の手動 redirect で、元の固定 URL と既知の GitHub 配布 CDN (`release-assets.githubusercontent.com` の指定ルート、旧 `objects.githubusercontent.com` の指定ルート) の HTTPS のみを許す。任意ホスト・HTTP・userInfo・fragment・別ポート・dot segment は拒否。Cookie／Authorization を転送しない。
- 最大 APK 256 MiB、API JSON 1 MiB、配布 JSON 16 KiB、チェックサム512 B。APK は8 KiBバッファでストリーム保存し、宣言されたサイズを超えた時点／未完了で停止する。空き容量は残量+20 MiBを確保し、取得中も確認する。connect/read timeout 各15秒、資産テキスト/API は各30秒、APK は180秒の経過時間制限も置く。キャンセル時は接続を切る。
- ハッシュはファイルの一致を示すだけで、真正性を代用しない。**apksig 8.6.1 の ApkVerifier による暗号学的検証**を必須とし、Android 24+ に対応する v2／v3／v3.1 の検証済み署名を要求する（v1のみは拒否）。その検証済み証明書が実インストール済み PackageInfo の単一 signer および配布 JSON と一致することを確認する。
- 検証後の APK から PackageManager で package／版／debuggable を読み、`com.memoez.app`・メタデータとの一致・実インストール code より増加・非debuggable を再確認。インストーラー起動の直前にも実インストール情報を読み直して再検証する。正式配布の証明書固定方針に合わせ、初版では鍵ローテーション例外を実装せず、安全側に拒否する。
- 固定名の `cache/updates/update.part` → 検証済み `update.apk` のみを扱う。失敗・中断・画面離脱・バックアップ画面への移動時は破棄。プロセス終了は次回モジュール初期化で両方を破棄し、承認状態も復元しない。取得済み APK の自動再利用／再インストールはしない。
- 引き渡しは `${applicationId}.updates` の非exported FileProvider、専用 cache-path の `content://` と一時読取 grant／ClipData を使用。system-only のインストーラーに限定する。Activity result／アプリ復帰で URI grant を取り消し、キャッシュを破棄する。インストーラーが読み込む間は保持する。OEM が結果を返さず復帰した場合も成功を仮定せず、再確認を案内する。
- native が並行操作を拒否し、画面も連打を抑止する。キャンセル後／画面離脱後にインストーラーを遅延起動しない。React Native に返す失敗情報は理由コードのみで、署名検証例外や署名付き CDN URL をそのまま表示しない。

GitHub へ送信するのは固定 GET と公開リリース資産の取得だけ。メモ本文、SQLite、バックアップ、認証情報、インストール済み証明書や版は送信しない。Google 認証や GitHub API キーも不要。アプリデータの維持は同一署名の Android 上書きインストールを前提とし、最終判定は OS が行う。

## 自動検証

- JVM テストで JSON の厳密な型・版・欠損／重複資産・ハッシュ・URL／redirect・サイズ上限・timeout・通信中断・容量不足・キャッシュ破棄を検証。
- aapt2 で小さな実 APK を作り、2つの一時テスト鍵で署名する。apksig による API 24/26/28/35 向けの署名検証、別鍵・unsigned・v1のみ・署名対象内容の改変・別 package・旧 code・debuggable の拒否を確認する。これは JVM 上の検証であり、端末上での API 互換性やインストール成功を表さない。テスト鍵と APK は一時ディレクトリから削除し、正式鍵を使わない。
- Jest で実版の表示元、明示的な確認／取得／許可／起動、復帰しても自動インストールしないこと、連打・中断・バックアップ導線を確認。
- PR/debug CI と正式公開の Secrets なし build ジョブの両方で native セキュリティテストを実行する。署名・公開ガードと配布契約は変更しない。

```sh
npm ci --no-audit --no-fund
npx tsc --noEmit
npm test -- --runInBand
npx expo prebuild --platform android --clean --no-install
(cd android && ./gradlew :memoez-updates:testDebugUnitTest :app:assembleDebug :app:assembleRelease lintDebug -x checkKotlinGradlePluginConfigurationErrors --no-configuration-cache --no-daemon --max-workers=2)
python3 -m unittest discover -s tools/tests -v
```

古い `.expo/types/router.d.ts` が残る環境では、Expo の通常起動でルートを再生成してから型検査する。新規 checkout／prebuild の生成物・ロックファイルを手修正する必要はない。

## 実機確認チェック（すべて未実施）

PR #77 実装時点では正式署名運用は未開始。以降の設定状況と初回公開は [Issue #79 のチェック・記録](releasing.md#v060-初回正式公開チェック記録issue-79) を参照し、設定済みとの報告を正式署名・公開成功と同一視しない。Issue #79 では新署名版の新規導入と更新不要表示を確認し、下記の次版への自己更新・旧鍵版の上書き・Google Drive／OAuth は保留・未検証とする。下記は今後の実機試験一覧であり、初回公開の完了条件は参照先に従う。実装者は設定変更・正式タグ／Release 作成を行わない。

1. 初版 v0.6.0 の updater は既存配布経路で導入する。**自己更新の成功確認は、その後の新しい正式な増加版を公開して初めて可能。** 現在の旧 v0.5.0 資産に適用して成功としない。
2. 実 PackageInfo、未公開／旧契約／同版／旧版／新版とノート、オフライン・利用制限・資産不備を画面で確認する。
3. 取得中のバック・中断・機内モード・容量不足・アプリの強制終了と再起動を確認し、一時ファイルと進行状態が残らないことを確認する。検証失敗後に OS インストーラーが開かないことも確認する。
4. Android 24/25、26+、28+、35 で、許可未設定→設定→拒否→戻る、許可後の明示起動、インストーラーの取消・失敗・成功、URI 権限とファイル破棄を確認する。画面回転・素早い連打・権限取り消しも確認する。
5. 同一正式鍵で前版→増加版を上書きし、メモ・チェックリスト・ラベル・期限・表示設定・JSON／Drive のバックアップ復元・2×2／4×2ウィジェット表示と編集を照合する。旧 debug →別鍵への迂回や、バックアップなしの削除は行わない。
6. 正式版の Google Sign-In／Drive を確認する。OAuth に正式証明書の SHA-1 が必要。既存のバックアップ形式や認証仕様の変更はない。

## 今回の確認結果

- TypeScript、JavaScript Lint、Jest 29スイート／138テスト、ネイティブ22テスト（失敗・スキップなし）が成功。
- clean prebuild、最終ソースの debug／unsigned release APK、Android lintDebug が成功。更新 Module と apksig、専用 Provider の exported=false／読取 URI grant と cache-path、インストール権限、既存ウィジェット全クラスと Google Sign-In の同梱を APK から確認した。
- app.json／package.json／package-lock と実 APK の 0.6.0/code9 の整合を確認。正式公開ガード32テストと actionlint が成功。実際の release APK を一時テスト鍵で2回署名する既存の配布 smoke test も成功し、鍵・署名済みテスト資産は削除済み。
- ネイティブテストの HTTP は制御した fake HTTPS 接続であり、実端末から GitHub への通信・OS の設定／インストーラー画面は未検証。JVM の署名検証を実機上書き成功と同一視しない。
- 正式鍵、GitHub の保護／Environment／Secrets／OAuth、正式タグ・Release・自己更新用の次版は作成していない。上の実機チェック項目は未完了のまま残す。
