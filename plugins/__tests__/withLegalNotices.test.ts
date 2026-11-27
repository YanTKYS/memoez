/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { copyLegalFiles, FILES } = require('../withLegalNotices');
/* eslint-enable @typescript-eslint/no-require-imports */

const root = path.resolve(__dirname, '..', '..');

describe('license notices shipped in the APK', () => {
  it('copies LICENSE and the third-party license texts into assets/legal', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'memoez-legal-'));
    for (const [src] of FILES) {
      fs.mkdirSync(path.dirname(path.join(tmp, src)), { recursive: true });
      fs.copyFileSync(path.join(root, src), path.join(tmp, src));
    }
    const dest = copyLegalFiles(tmp);
    expect(fs.readFileSync(path.join(dest, 'LICENSE.txt'), 'utf8')).toContain('MIT License');
    const third = fs.readFileSync(path.join(dest, 'THIRD_PARTY_LICENSES.txt'), 'utf8');
    expect(third).toContain('Apache License');
    expect(third).toContain('Pictogrammers Free License');
    fs.rmSync(tmp, { recursive: true, force: true });
  });
  it('fails closed when a license file is missing', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'memoez-legal-'));
    let message = '';
    try {
      copyLegalFiles(tmp);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('Missing license file');
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
