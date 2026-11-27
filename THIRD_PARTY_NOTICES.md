# 第三者ソフトウェア・素材の通知

MemoEZ 自身のコードは [LICENSE](LICENSE)（MIT License）で提供します。この文書は、MemoEZ が利用する第三者のソフトウェア・素材は **MIT License の対象外**であり、それぞれ元のライセンスに従うことを示します。

**ライセンス全文・著作権表示は [legal/THIRD_PARTY_LICENSES.txt](legal/THIRD_PARTY_LICENSES.txt) に収録しています。** 同じ内容が、配布する APK の `assets/legal/THIRD_PARTY_LICENSES.txt`（と `assets/legal/LICENSE.txt`）として同梱されます（[配布物での通知の扱い](#配布物での通知の扱い)）。

バージョンは `package-lock.json` に基づきます。

## 配布する Android アプリ（APK）に取り込まれる主な第三者部分

### JavaScript / TypeScript 依存（Metro が JS バンドルに取り込む）

下表は直接の依存です。推移的依存を含め、JS バンドルに実際に取り込まれる 76 パッケージ（`expo export` のソースマップで確認）のライセンス表記と著作権表示を `legal/THIRD_PARTY_LICENSES.txt` に収録しています。内訳は MIT が大半で、BSD-3-Clause（`hoist-non-react-statics`、`ieee754`）と Apache-2.0（`drizzle-orm`）を含みます。

| パッケージ | ライセンス |
| --- | --- |
| react, react-native | MIT |
| expo, expo-router, expo-linking, expo-file-system, expo-sqlite, expo-status-bar | MIT |
| react-native-paper | MIT |
| react-native-safe-area-context, react-native-screens | MIT |
| zustand | MIT |
| @react-native-async-storage/async-storage | MIT |
| @react-native-google-signin/google-signin | MIT |
| @expo/vector-icons | MIT（Copyright (c) 2015 Joel Arvidsson / (c) 2020 650 Industries） |
| drizzle-orm | Apache-2.0 |

`react-native-vector-icons` も直接の依存ですが、アプリのコードは `@expo/vector-icons` のみを使用します（MIT、Copyright (c) 2015 Joel Arvidsson）。

`package-lock.json` には、MPL-2.0 の `lightningcss`、CC-BY-4.0 の `caniuse-lite`、BlueOak-1.0.0、0BSD、Unlicense、Python-2.0 の `argparse` など、上記以外のライセンス表記の依存もあります。これらは Expo／Metro のビルドツール由来で、JS バンドルのソースマップには現れないことを確認しました（APK に取り込まれません）。

### アイコンフォント

アプリは `@expo/vector-icons` の `MaterialCommunityIcons` を使用し、フォント `MaterialCommunityIcons.ttf` が配布物に含まれます。このフォントは [Material Design Icons](https://pictogrammers.com/library/mdi/)（Pictogrammers）に由来し、Pictogrammers Free License（フォント・アイコンは Apache License 2.0）の下で配布されています。npm パッケージにはフォント個別の LICENSE が無いため、同じ版系統の `@mdi/font` 6.5.95 の LICENSE 原文と Apache License 2.0 の全文を `legal/THIRD_PARTY_LICENSES.txt` に収録しています。他のアイコンファミリーの TTF はアプリが使用しないため、JS バンドルにも含まれません。

### ネイティブ（Android）依存

APK には、Expo SDK 52 / React Native 0.76.5 の Android 依存として、AndroidX、Kotlin 標準ライブラリ、Hermes、Google Play services（Google Sign-In）などが含まれます。これらは各提供元のライセンス（主に Apache-2.0、MIT）に従い、Apache License 2.0 の全文は `legal/THIRD_PARTY_LICENSES.txt` に収録しています。Gradle が解決する個別のネイティブ依存の一覧は、Android SDK のないビルド環境では確認できていないため、網羅していません。Google Play services と Google Sign-In の利用には Google の利用条件が適用され、MIT の対象ではありません。SQLite は `expo-sqlite` 経由で利用し、SQLCipher は使用していません（`app.json` の `useSQLCipher: false`）。

## MIT License の対象外

- 上記および `package-lock.json` に載る第三者のコード・フォント・資料。
- **アプリアイコンとスプラッシュ画像**（`assets/icon.svg`、`assets/*.png`、`docs/app-icon-preview.png`）。画像生成で検討した案を元に SVG として構成した経緯があるため、権利関係の確認が済むまで MIT の対象に含めません。すべての権利は留保されます。
- 「MemoEZ」の名称・ロゴ（商標としての許諾は行いません）。
- Google Drive 連携・Google API の利用条件（Google の規約が適用されます）。
- 利用者が作成したメモ、JSON／Google Drive のバックアップ（利用者のデータです）。
- 署名鍵・署名証明書・Secrets 等（リポジトリに含まれず、ライセンスの対象ではありません）。

## 配布物での通知の扱い

- 配布する APK に `assets/legal/LICENSE.txt`（MemoEZ の MIT）と `assets/legal/THIRD_PARTY_LICENSES.txt`（第三者の全文）を同梱します。`expo prebuild` 時に config plugin（`plugins/withLegalNotices.js`）が `LICENSE` と `legal/THIRD_PARTY_LICENSES.txt` をコピーします。ライセンス画面は追加せず、Releases の資産（APK・sha256・JSON の 3 点）も変えません。
- 既存の Android Build ワークフローが、debug APK に両ファイルが含まれることを確認します。
- 公開版の通知は、リリース JSON の `commit` 時点のこの文書でも確認できます。

### 依存を更新したとき

`legal/THIRD_PARTY_LICENSES.txt` を更新します。手順：

1. `npm ci` 後、`npx expo export --platform android --dev=false --source-maps --output-dir <一時ディレクトリ>` を実行する。
2. 出力のソースマップ（`index.ts.map`）の `sources` から `node_modules/<パッケージ>` を集め、各パッケージの `LICENSE` 原文と著作権表示を収録する。tarball に LICENSE が無いパッケージ（`expo-*`、`@react-native/*`、`metro-runtime`、`react-devtools-core`、`@radix-ui/*`、`drizzle-orm`）は同じリポジトリの LICENSE 原文を使う。
3. アイコンフォントを変更したときは、フォントの元ライセンスを確認して追記する。
