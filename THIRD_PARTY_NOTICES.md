# 第三者ソフトウェア・素材の通知

MemoEZ 自身のコードは [LICENSE](LICENSE)（MIT License）で提供します。この文書は、MemoEZ が利用する第三者のソフトウェア・素材は **MIT License の対象外**であり、それぞれ元のライセンスに従うことを示します。各ライセンスの全文・著作権表示は、各パッケージが配布する `LICENSE` ファイル（`npm install` 後の `node_modules/<パッケージ名>/`）と上流の配布元にあります。ここでは再配布せず、元の通知を変更しません。

バージョンは `package-lock.json` に基づきます。ライセンス表記は各パッケージの `package.json` / `package-lock.json` の `license` 欄によるものです。

## 配布する Android アプリ（APK）に取り込まれる主な第三者部分

### JavaScript / TypeScript 依存（Metro が JS バンドルに取り込む）

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

これらの推移的依存を含む本番依存のライセンスは、`package-lock.json` 上で MIT・ISC・BSD 系・Apache-2.0 が大半です。それ以外の表記（例：MPL-2.0 の `lightningcss`、CC-BY-4.0 の `caniuse-lite`、BlueOak-1.0.0、0BSD、Unlicense、Python-2.0 の `argparse` など）は主に Expo／Metro のビルドツール由来であり、APK へ取り込まれる範囲は確認していません。配布物へ取り込まれる場合は、元のライセンスと通知を維持します。

### アイコンフォント

アプリは `@expo/vector-icons` の `MaterialCommunityIcons` を使用します。同梱フォント（`MaterialCommunityIcons.ttf`）は [Material Design Icons](https://pictogrammers.com/library/mdi/) に由来し、`@expo/vector-icons` の README に従い、フォント自体は MIT 部分とは別に元の作者の著作物です。上流の表示では Apache License 2.0 / SIL Open Font License 1.1 とされています。`@expo/vector-icons` の npm パッケージにはこのフォント個別の LICENSE ファイルが含まれていないため、配布時は上流（Pictogrammers / Material Design Icons）の許諾文を参照してください。他のアイコンファミリー（Ionicons、FontAwesome 等）はパッケージに含まれますが、アプリはその形式を使用しません。

### ネイティブ（Android）依存

APK には、Expo SDK 52 / React Native 0.76.5 の Android 依存として、AndroidX、Kotlin 標準ライブラリ、Hermes、Google Play services（Google Sign-In）などが含まれます。これらは各提供元のライセンス（主に Apache-2.0、MIT）に従います。Google Play services と Google Sign-In の利用には Google の利用条件が適用され、MIT の対象ではありません。SQLite は `expo-sqlite` 経由で利用し、SQLCipher は使用していません（`app.json` の `useSQLCipher: false`）。

## MIT License の対象外

- 上記および `package-lock.json` に載る第三者のコード・フォント・資料。
- **アプリアイコンとスプラッシュ画像**（`assets/icon.svg`、`assets/*.png`、`docs/app-icon-preview.png`）。画像生成で検討した案を元に SVG として構成した経緯があるため、権利関係の確認が済むまで MIT の対象に含めません。すべての権利は留保されます。
- 「MemoEZ」の名称・ロゴ（商標としての許諾は行いません）。
- Google Drive 連携・Google API の利用条件（Google の規約が適用されます）。
- 利用者が作成したメモ、JSON／Google Drive のバックアップ（利用者のデータです）。
- 署名鍵・署名証明書・Secrets 等（リポジトリに含まれず、ライセンスの対象ではありません）。

## 配布物での通知の扱い

正式リリースの APK には第三者のコードが含まれます。公開版のライセンス・通知は、その版の `commit`（リリース JSON に記載）のこの文書と `package-lock.json`、および各パッケージの `LICENSE` で確認できます。依存を追加・更新した場合は、本文書の該当部分を更新します。
