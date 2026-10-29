/* eslint-disable @typescript-eslint/no-require-imports */
const { unsignedRelease } = require('../withAndroidBuild');
/* eslint-enable @typescript-eslint/no-require-imports */

describe('SDK 52 release signing override', () => {
  const template = `buildTypes {
    debug { signingConfig signingConfigs.debug }
    release {
      // Caution! In production, you need to generate your own keystore file.
      // see https://reactnative.dev/docs/signed-apk-android.
      signingConfig signingConfigs.debug
      minifyEnabled false
    }
  }`;
  it('keeps debug signed and makes release unsigned, including clean prebuild comments', () => {
    const result = unsignedRelease(template);
    expect(result).toContain('debug { signingConfig signingConfigs.debug }');
    expect(result).toContain('signingConfig null');
    expect(result).toContain('minifyEnabled false');
    expect(unsignedRelease(result)).toBe(result);
  });
  it('fails closed when a future Expo template changes the release block', () => {
    let message = '';
    try {
      unsignedRelease('release { customSigning() }');
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('Unsupported release signing template');
  });
});
