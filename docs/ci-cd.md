# CI / 配布

## 通常 CI

`.github/workflows/android-build.yml` は PR と main push、手動起動で Python の公開ガードテスト・Jest・TypeScript・Expo prebuild・debug APK ビルドを実行する。PR では既存 Android Lint も実行する。署名 Secrets は参照せず、contents は read のみ。

debug APK は Actions Artifacts に14日を要求する（実際の保持期間はリポジトリ／組織のポリシーに従う）。これは開発用であり、正式配布・継続更新の署名を保証しない。以前の main 用 unsigned release Artifact は廃止した。

## Expo SDK 52 のビルド設定

`plugins/withAndroidBuild.js` を `app.json` に登録している。clean prebuild のたびに Kotlin 1.9.25 の classpath、互換性・ワーカー数・configuration cache 無効化を設定し、release の debug signing を外す。生成された `android/` の手修正や Workflow 内 sed は不要。debug の署名設定は維持する。SDK の将来のテンプレートが変わった際は、unsigned release 設定を黙って省略せず prebuild を失敗させる。

## 正式配布

`.github/workflows/release-signed-apk.yml` はオーナーの main からの手動起動専用。タグ push で公開しない。デフォルトは公開無効で、Environment と main 保護、証明書の固定値等が必須。

署名鍵の安全な初回設定・オーナーマージ／公開判断・3資産の配布契約・重複時の停止・旧 debug 端末からのバックアップ移行は **[releasing.md](releasing.md)** を参照。署名設定なしの unsigned 公開や beta／draft の正式公開は行わない。
