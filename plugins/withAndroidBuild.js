/** Reproduce SDK 52 Kotlin compatibility and genuinely unsigned release APKs. */
const { withAppBuildGradle, withProjectBuildGradle, withGradleProperties } = require('expo/config-plugins');

function unsignedRelease(contents) {
  if (/release\s*\{(?:\s|\/\/[^\n]*\n)*signingConfig null/.test(contents)) return contents;
  const pattern = /(release\s*\{(?:\s|\/\/[^\n]*\n)*)signingConfig signingConfigs\.debug/;
  if (!pattern.test(contents)) throw new Error('Unsupported release signing template; refusing debug-signed release');
  return contents.replace(pattern, '$1signingConfig null');
}

module.exports = (config) => {
  config = withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = unsignedRelease(cfg.modResults.contents);
    return cfg;
  });
  config = withProjectBuildGradle(config, (cfg) => {
    cfg.modResults.contents = cfg.modResults.contents.replace(
      "classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')",
      'classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:${kotlinVersion}")',
    );
    return cfg;
  });
  return withGradleProperties(config, (cfg) => {
    const overrides = {
      'android.kotlinVersion': '1.9.25',
      'kotlin.jvm.target.validation.mode': 'warning',
      'org.gradle.configuration-cache': 'false',
      'org.gradle.workers.max': '2',
    };
    cfg.modResults = cfg.modResults.filter((p) => p.type !== 'property' || !(p.key in overrides));
    for (const [key, value] of Object.entries(overrides)) cfg.modResults.push({ type: 'property', key, value });
    return cfg;
  });
};
module.exports.unsignedRelease = unsignedRelease;
