import * as fs from 'fs';
import * as path from 'path';

/* eslint-disable @typescript-eslint/no-require-imports */
const plugin = require('../withMemoEZWidget') as {
  addHostActivities: (manifest: Manifest) => Manifest;
  renderHostSource: (template: string, appPackage: string) => string;
  HOST_ACTIVITIES: { file: string; name: string }[];
};
/* eslint-enable @typescript-eslint/no-require-imports */

type Activity = { $: Record<string, string>; 'intent-filter'?: { action: { $: Record<string, string> }[] }[] };
type Manifest = { manifest: { $: Record<string, string>; application: { $: Record<string, string>; activity?: Activity[] }[] } };

function manifest(): Manifest {
  return {
    manifest: {
      $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' },
      application: [{ $: { 'android:name': '.MainApplication' }, activity: [{ $: { 'android:name': '.MainActivity' } }] }],
    },
  };
}

const activities = (m: Manifest) => m.manifest.application[0]!.activity ?? [];
const byName = (m: Manifest, suffix: string) => activities(m).find((a) => a.$['android:name']!.endsWith(suffix))!;

describe('withMemoEZWidget config plugin', () => {
  it('registers both widget windows as translucent activities in their own task, next to MainActivity', () => {
    const result = plugin.addHostActivities(manifest());
    expect(activities(result).map((a) => a.$['android:name'])).toEqual([
      '.MainActivity',
      'expo.modules.memoezwidget.host.FloatingEditorActivity',
      'expo.modules.memoezwidget.host.WidgetConfigActivity',
    ]);

    for (const name of ['FloatingEditorActivity', 'WidgetConfigActivity']) {
      expect(byName(result, name).$).toMatchObject({
        'android:theme': '@style/Theme.MemoEZ.Floating',
        'android:taskAffinity': '${applicationId}.widget',
        'android:excludeFromRecents': 'true',
        'android:windowSoftInputMode': 'adjustResize|stateHidden',
      });
      // 透過 Activity の向き固定は Android 8.0 で例外になる
      expect(byName(result, name).$['android:screenOrientation']).toBe(undefined);
    }
    expect(byName(result, 'FloatingEditorActivity').$['android:exported']).toBe('false');
    expect(byName(result, 'WidgetConfigActivity').$['android:exported']).toBe('true');
    expect(byName(result, 'WidgetConfigActivity')['intent-filter']).toEqual([
      { action: [{ $: { 'android:name': 'android.appwidget.action.APPWIDGET_CONFIGURE' } }] },
    ]);
  });

  it('can run on every prebuild without duplicating entries', () => {
    const once = plugin.addHostActivities(manifest());
    const twice = plugin.addHostActivities(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
  });

  it('generates activities that wrap the delegate like Expo SDK 52 MainActivity', () => {
    for (const { file } of plugin.HOST_ACTIVITIES) {
      const template = fs.readFileSync(path.join(__dirname, '..', 'templates', file), 'utf8');
      const source = plugin.renderHostSource(template, 'com.memoez.app');

      expect(source).toContain('import com.memoez.app.BuildConfig');
      expect(source).toContain('import expo.modules.ReactActivityDelegateWrapper');
      expect(source).toContain(
        'ReactActivityDelegateWrapper(this, BuildConfig.IS_NEW_ARCHITECTURE_ENABLED, createWindowDelegate())',
      );
      expect(source).not.toContain('{{');
    }
  });
});
