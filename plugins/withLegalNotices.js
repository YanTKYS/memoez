/** Ship MemoEZ's LICENSE and third-party license texts inside the APK (assets/legal/). */
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

// [source relative to the project root, file name under assets/legal/]
const FILES = [
  ['LICENSE', 'LICENSE.txt'],
  ['legal/THIRD_PARTY_LICENSES.txt', 'THIRD_PARTY_LICENSES.txt'],
];

function copyLegalFiles(projectRoot) {
  const dest = path.join(projectRoot, 'android', 'app', 'src', 'main', 'assets', 'legal');
  fs.mkdirSync(dest, { recursive: true });
  for (const [src, name] of FILES) {
    const from = path.join(projectRoot, src);
    if (!fs.existsSync(from)) throw new Error(`Missing license file: ${src}`);
    fs.copyFileSync(from, path.join(dest, name));
  }
  return dest;
}

module.exports = (config) =>
  withDangerousMod(config, [
    'android',
    (cfg) => {
      copyLegalFiles(cfg.modRequest.projectRoot);
      return cfg;
    },
  ]);
module.exports.copyLegalFiles = copyLegalFiles;
module.exports.FILES = FILES;
