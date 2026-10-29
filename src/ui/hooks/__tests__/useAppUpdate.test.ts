import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useAppUpdate } from '@/ui/hooks/useAppUpdate';
import { updatesBridge, type UpdateCheck } from '@/lib/updates/updatesBridge';

jest.mock('@/lib/updates/updatesBridge', () => ({
  updatesBridge: {
    installed: () => ({ versionName: '9.8.7', versionCode: 123, debuggable: false }),
    canInstall: () => true,
    check: async () => ({ status: 'none', release: null, reason: null, page: null, versionName: null }),
    download: async () => true,
    install: async () => true,
    openPermission: async () => true,
    cancel: () => {}, discard: () => {},
    onProgress: () => ({ remove() {} }), onInstaller: () => ({ remove() {} }),
  },
}));
const available: UpdateCheck = { status: 'available', versionName: '9.8.8', page: 'https://github.com/YanTKYS/memoez/releases/tag/v9.8.8', reason: null, release: { versionName: '9.8.8', versionCode: 124, notes: 'Notes', page: 'https://github.com/YanTKYS/memoez/releases/tag/v9.8.8', size: 1024 } };
afterEach(() => jest.restoreAllMocks());

describe('user-driven app updates', () => {
  it('reads actual installed info on mount/resume and never fetches automatically', () => {
    const check = jest.spyOn(updatesBridge, 'check');
    const download = jest.spyOn(updatesBridge, 'download');
    const life = jest.spyOn(AppState, 'addEventListener');
    const hook = renderHook(() => useAppUpdate());
    expect(hook.result.current.installed?.versionName).toBe('9.8.7');
    expect(hook.result.current.installed?.versionCode).toBe(123);
    const resume = life.mock.calls[0][1] as (value: string) => void;
    act(() => resume('active'));
    expect(check).not.toHaveBeenCalled();
    expect(download).not.toHaveBeenCalled();
    hook.unmount();
  });
  it('requires separate explicit check, download, permission and installer operations', async () => {
    jest.spyOn(updatesBridge, 'check').mockResolvedValue(available);
    const download = jest.spyOn(updatesBridge, 'download');
    const install = jest.spyOn(updatesBridge, 'install');
    const permission = jest.spyOn(updatesBridge, 'canInstall').mockReturnValue(false);
    const openPermission = jest.spyOn(updatesBridge, 'openPermission');
    const life = jest.spyOn(AppState, 'addEventListener');
    const hook = renderHook(() => useAppUpdate());
    await act(async () => { await hook.result.current.check(); });
    expect(hook.result.current.result?.status).toBe('available');
    expect(download).not.toHaveBeenCalled();
    await act(async () => { await hook.result.current.download(); });
    expect(hook.result.current.ready).toBe(true);
    expect(install).not.toHaveBeenCalled();
    await act(async () => { await hook.result.current.openPermission(); });
    expect(openPermission).toHaveBeenCalledTimes(1);
    permission.mockReturnValue(true);
    act(() => (life.mock.calls[0][1] as (value: string) => void)('active'));
    expect(install).not.toHaveBeenCalled();
    await act(async () => { await hook.result.current.install(); });
    expect(install).toHaveBeenCalledTimes(1);
    expect(hook.result.current.installerOpen).toBe(true);
    hook.unmount();
  });
  it('serializes rapid taps and discards on leaving the screen', async () => {
    const check = jest.spyOn(updatesBridge, 'check').mockResolvedValue(available);
    const discard = jest.spyOn(updatesBridge, 'discard');
    const hook = renderHook(() => useAppUpdate());
    await act(async () => { await Promise.all([hook.result.current.check(), hook.result.current.check()]); });
    expect(check).toHaveBeenCalledTimes(1);
    hook.unmount();
    expect(discard).toHaveBeenCalledTimes(1);
  });
  it('shows cancellation and never opens installer after a rejected download', async () => {
    let rejectDownload: (error: unknown) => void = () => {};
    jest.spyOn(updatesBridge, 'download').mockImplementation(() => new Promise<boolean>((_, reject) => { rejectDownload = reject; }));
    const cancel = jest.spyOn(updatesBridge, 'cancel');
    const install = jest.spyOn(updatesBridge, 'install');
    const hook = renderHook(() => useAppUpdate());
    let operation: Promise<void> = Promise.resolve();
    act(() => { operation = hook.result.current.download(); });
    act(() => hook.result.current.cancel());
    await act(async () => { rejectDownload({ code: 'cancelled' }); await operation; });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(hook.result.current.ready).toBe(false);
    expect(hook.result.current.message).toContain('中断');
    expect(install).not.toHaveBeenCalled();
    hook.unmount();
  });
  it('requires OS permission again if it was revoked and never auto installs', async () => {
    jest.spyOn(updatesBridge, 'canInstall').mockReturnValue(false);
    const install = jest.spyOn(updatesBridge, 'install');
    const hook = renderHook(() => useAppUpdate());
    await act(async () => { await hook.result.current.install(); });
    expect(install).not.toHaveBeenCalled();
    expect(hook.result.current.message).toContain('許可');
    hook.unmount();
  });
});
