import { updateError, updateStatus } from '../messages';
import type { UpdateCheck } from '../updatesBridge';
const check = (status: UpdateCheck['status'], reason: string | null = null): UpdateCheck => ({ status, reason, page: null, versionName: null, release: null });
describe('update outcomes', () => {
  it('distinguishes no release, legacy, same version, old version and update available', () => {
    expect(updateStatus(check('none'))).toContain('まだ公開');
    expect(updateStatus(check('unsupported', 'legacy'))).toContain('対象外');
    expect(updateStatus(check('current'))).toContain('最新');
    expect(updateStatus(check('older'))).toContain('更新しません');
    expect(updateStatus(check('available'))).toContain('新しい版');
    expect(updateStatus(check('blocked', 'signature'))).toContain('署名');
  });
  it('explains failures without displaying raw URLs, credentials or native exception text', () => {
    for (const code of ['storage', 'network', 'rate_limit', 'checksum', 'signature', 'permission', 'cancelled']) expect(updateError({ code })).not.toBe('');
    expect(updateError({ code: 'unknown', message: 'PRIVATE-DETAILS' })).not.toContain('PRIVATE-DETAILS');
  });
});
