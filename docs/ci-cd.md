# CI / 配布

## 通常 CI

`.github/workflows/android-build.yml` は PR と main push、手動起動で Python の公開ガードテスト・Jest・TypeScript・Expo prebuild・debug APK ビルドを実行する。PR では既存 Android Lint も実行する。署名 Secrets は参照せず、contents は read のみ。

debug APK は Actions Artifacts に14日を要求する（実際の保持期間はリポジトリ／組織のポリシーに従う）。これは開発用であり、正式配布・継続更新の署名を保証しない。以前の main 用 unsigned release Artifact は廃止した。

## PR のレビューとマージ

AI が Issue を実装して PR を作成 → ChatGPT がレビュー → オーナーが CI と内容を確認して手動マージ → 公開済み版より増加した版だけ自動 Release、の順とする。`pr-auto-merge-and-delete.yml` は削除し、bot によるマージや手動実行経路は残さない。日常運用で Actions を停止する操作や追加承認は不要。

マージ後のブランチ削除が必要なら、オーナーが GitHub 標準の `Settings → General → Pull Requests → Automatically delete head branches` を利用する。リポジトリ設定を Workflow から変更しない。

初回 v0.6.0 公開では **Issue #81 の削除 PR を PR #80 より先に main へ取り込む**。削除 PR のマージまでは、オーナーが `MEMOEZ_RELEASE_ENABLED=false` を確認・維持する。現 main の v0.6.0 は未公開なので、版を変更しない削除 PR でも、公開フラグを有効にすると初回公開候補になり得る。移行中は旧 Workflow がまだ main にあるため、PR #80 は Draft のまま保持する。

削除の main 反映後、PR #80 の CI・公開前チェックを確認し、オーナーが公開直前に `MEMOEZ_RELEASE_ENABLED=true` として Ready for review に切り替え、本人が手動マージする。実装担当は公開フラグ・GitHub 設定・Secrets・正式タグ／Release を変更しない。

## Expo SDK 52 のビルド設定

`plugins/withAndroidBuild.js` を `app.json` に登録している。clean prebuild のたびに Kotlin 1.9.25 の classpath、互換性・ワーカー数・configuration cache 無効化を設定し、release の debug signing を外す。生成された `android/` の手修正や Workflow 内 sed は不要。debug の署名設定は維持する。SDK の将来のテンプレートが変わった際は、unsigned release 設定を黙って省略せず prebuild を失敗させる。

## 正式配布

`.github/workflows/release-signed-apk.yml` はmain push 起動で、API で確認したオーナーのレビュー済み PR マージを承認として新版だけ自動公開する。同じ版は SDK／release ビルド／署名前に正常 skip。PR・タグ・手動イベントからは公開せず、毎回の Environment 追加承認も使わない。デフォルトは公開無効で、Environment と main 保護、証明書の固定値等が必須。

署名鍵の安全な初回設定・オーナーマージ／公開判断・3資産の配布契約・重複時の停止・旧 debug 端末からのバックアップ移行は **[releasing.md](releasing.md)** を参照。署名設定なしの unsigned 公開や beta／draft の正式公開は行わない。
