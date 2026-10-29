import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { updatesBridge, type InstalledInfo, type UpdateCheck, type UpdateProgress } from '@/lib/updates/updatesBridge';
import { updateError } from '@/lib/updates/messages';

export function useAppUpdate() {
  const alive = useRef(false);
  const running = useRef(false);
  const pendingInstaller = useRef(false);
  const [installed, setInstalled] = useState<InstalledInfo | null>(null);
  const [result, setResult] = useState<UpdateCheck | null>(null);
  const [busy, setBusy] = useState<'checking' | 'downloading' | 'installing' | null>(null);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [ready, setReady] = useState(false);
  const [installerOpen, setInstallerOpen] = useState(false);
  const [permission, setPermission] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    alive.current = true;
    const localInfo = () => {
      try { setInstalled(updatesBridge.installed()); setPermission(updatesBridge.canInstall()); }
      catch (error) { setMessage(updateError(error)); }
    };
    localInfo(); // PackageInfo only: no check or download at screen mount/resume.
    const subscription = updatesBridge.onProgress((value) => { if (alive.current) setProgress(value); });
    const installer = updatesBridge.onInstaller(({ completed }) => {
      if (!alive.current) return;
      setReady(false); pendingInstaller.current = false; setInstallerOpen(false); setResult(null);
      localInfo();
      setMessage(completed ? 'Android のインストーラーの処理が完了しました。現在の版をご確認ください。' : 'インストールを完了せずに戻りました。必要なら最新版を再確認してください。');
    });
    const lifecycle = AppState.addEventListener('change', (state) => { if (state === 'active' && alive.current) localInfo(); });
    return () => { alive.current = false; subscription.remove(); installer.remove(); lifecycle.remove(); updatesBridge.discard(); };
  }, []);

  async function run(kind: NonNullable<typeof busy>, action: () => Promise<void>) {
    if (running.current || pendingInstaller.current) return;
    running.current = true;
    setBusy(kind); setMessage('');
    try { await action(); }
    catch (error) { if (alive.current) { setReady(false); if (kind === 'installing') setResult(null); setMessage(updateError(error)); } }
    finally { running.current = false; if (alive.current) setBusy(null); }
  }
  const check = () => run('checking', async () => {
    setResult(null); setReady(false); setProgress(null);
    const value = await updatesBridge.check();
    if (alive.current) setResult(value);
  });
  const download = () => run('downloading', async () => {
    setReady(false); setProgress(null);
    await updatesBridge.download();
    if (alive.current) { setReady(true); setPermission(updatesBridge.canInstall()); setMessage('更新ファイルを検証しました。Android の確認画面で更新できます。'); }
  });
  const install = () => run('installing', async () => {
    if (!updatesBridge.canInstall()) { setPermission(false); throw Object.assign(new Error('permission'), { code: 'permission' }); }
    await updatesBridge.install();
    if (alive.current) { setReady(false); pendingInstaller.current = true; setInstallerOpen(true); setMessage('Android の画面で更新を確認してください。'); }
  });
  async function openPermission() {
    try { await updatesBridge.openPermission(); }
    catch (error) { if (alive.current) setMessage(updateError(error)); }
  }
  const cancel = () => { updatesBridge.cancel(); setMessage('取得を中断しています…'); };
  const discard = () => { updatesBridge.discard(); setReady(false); setResult(null); setProgress(null); setMessage(''); };
  return { installed, result, busy, progress, ready, installerOpen, permission, message, check, download, install, openPermission, cancel, discard };
}
