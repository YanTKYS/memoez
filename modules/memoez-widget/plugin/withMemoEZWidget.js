/**
 * MemoEZ ホーム画面ウィジェットの config plugin。
 *
 * ウィジェットから開くウィンドウの Activity は、Expo SDK 52 の MainActivity と同じく
 * `expo.modules.ReactActivityDelegateWrapper` でデリゲートを包む必要がある。
 * このクラスは `expo` パッケージ（全 Expo モジュールに依存する）にあり、
 * ローカルモジュール（modules/memoez-widget/android）からは依存が循環して参照できないため、
 * `expo prebuild` 時にアプリ側へ薄いサブクラスを生成し、マニフェストに登録する。
 * android/ は生成物のままで、`expo prebuild --clean` のたびに同じ内容が作り直される。
 */
const fs = require('fs');
const path = require('path');
const { AndroidConfig, withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

const HOST_PACKAGE = 'expo.modules.memoezwidget.host';
const TEMPLATE_DIR = path.join(__dirname, 'templates');

/** 透過ウィンドウ共通の属性（テーマ・リソースは modules/memoez-widget/android にある） */
const WINDOW_ATTRIBUTES = {
  // 透過テーマでホーム画面を背後に残す（オーバーレイ権限は使わない）
  'android:theme': '@style/Theme.MemoEZ.Floating',
  // MemoEZ 本体とは別タスクで開き、本体の画面を前面に出さない
  'android:taskAffinity': '${applicationId}.widget',
  'android:excludeFromRecents': 'true',
  // MainActivity と揃え、テーマ切替などで React Native の画面を作り直さない。
  // 透過 Activity に画面向きを固定すると Android 8.0 で例外になるため screenOrientation は付けない
  'android:configChanges':
    'keyboard|keyboardHidden|orientation|screenSize|screenLayout|smallestScreenSize|uiMode',
  'android:windowSoftInputMode': 'adjustResize|stateHidden',
};

const HOST_ACTIVITIES = [
  {
    file: 'FloatingEditorActivity.kt',
    name: `${HOST_PACKAGE}.FloatingEditorActivity`,
    attributes: { 'android:exported': 'false', 'android:launchMode': 'standard' },
  },
  {
    file: 'WidgetConfigActivity.kt',
    name: `${HOST_PACKAGE}.WidgetConfigActivity`,
    // ランチャーがウィジェット配置時に起動する
    attributes: { 'android:exported': 'true' },
    intentAction: 'android.appwidget.action.APPWIDGET_CONFIGURE',
  },
];

/** アプリのマニフェストへウィンドウ用 Activity を登録する（何度実行しても同じ結果になる） */
function addHostActivities(androidManifest) {
  const application = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);
  const hostNames = new Set(HOST_ACTIVITIES.map((a) => a.name));
  application.activity = (application.activity ?? []).filter(
    (activity) => !hostNames.has(activity.$?.['android:name']),
  );
  for (const host of HOST_ACTIVITIES) {
    const activity = { $: { 'android:name': host.name, ...WINDOW_ATTRIBUTES, ...host.attributes } };
    if (host.intentAction) {
      activity['intent-filter'] = [{ action: [{ $: { 'android:name': host.intentAction } }] }];
    }
    application.activity.push(activity);
  }
  return androidManifest;
}

/** テンプレートにアプリのパッケージ名（BuildConfig の場所）を埋め込む */
function renderHostSource(template, appPackage) {
  return template.replaceAll('{{APP_PACKAGE}}', appPackage);
}

function writeHostSources(platformProjectRoot, appPackage) {
  const outDir = path.join(platformProjectRoot, 'app', 'src', 'main', 'java', ...HOST_PACKAGE.split('.'));
  fs.mkdirSync(outDir, { recursive: true });
  for (const host of HOST_ACTIVITIES) {
    const template = fs.readFileSync(path.join(TEMPLATE_DIR, host.file), 'utf8');
    fs.writeFileSync(path.join(outDir, host.file), renderHostSource(template, appPackage));
  }
}

function withMemoEZWidget(config) {
  config = withAndroidManifest(config, (cfg) => {
    cfg.modResults = addHostActivities(cfg.modResults);
    return cfg;
  });
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const appPackage = AndroidConfig.Package.getPackage(cfg);
      if (!appPackage) {
        throw new Error('withMemoEZWidget: app.json の android.package が必要です');
      }
      writeHostSources(cfg.modRequest.platformProjectRoot, appPackage);
      return cfg;
    },
  ]);
}

module.exports = withMemoEZWidget;
module.exports.addHostActivities = addHostActivities;
module.exports.renderHostSource = renderHostSource;
module.exports.HOST_ACTIVITIES = HOST_ACTIVITIES;
