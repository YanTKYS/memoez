import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { BackupError, toUserMessage } from '@/domain/backup/BackupError';
import { backupToRemote, restoreFromRemote } from '@/domain/usecases/driveBackup';
import type { ImportPolicy } from '@/domain/usecases/backupJson';
import { getLabelRepository, getNoteRepository, getRemoteBackupStore } from '@/lib/di';
import { isGoogleDriveConfigured } from '@/lib/googleDrive/config';
import {
  connectGoogleAccount,
  disconnectGoogleAccount,
  restoreGoogleAccount,
} from '@/lib/googleDrive/googleAuth';

export type DriveBusy = 'connect' | 'backup' | 'restore' | 'disconnect' | null;

export interface DriveResult {
  ok: boolean;
  text: string;
}

const RESTORE_MESSAGE: Record<ImportPolicy, string> = {
  overwrite:
    'Google Drive のバックアップから復元します。\n\n現在のメモはすべて削除され、バックアップの内容に置き換えられます。',
  merge:
    'Google Drive のバックアップから復元します。\n\n現在のメモは残したまま、バックアップにあるメモのうち同じ内容のものを除いて追加します。',
};

function failure(e: unknown): DriveResult {
  if (!(e instanceof BackupError)) console.error('[GoogleDrive] unexpected error', e);
  return { ok: false, text: toUserMessage(e) };
}

/**
 * Google Drive バックアップ／復元の画面状態。
 * 認証・API 呼び出しは lib、保存／復元の手順は domain の usecase に任せ、ここは状態管理のみ。
 */
export function useGoogleDriveBackup(policy: ImportPolicy) {
  const configured = isGoogleDriveConfigured();
  const [email, setEmail] = useState<string | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState<Date | null>(null);
  const [busy, setBusy] = useState<DriveBusy>(null);
  const [result, setResult] = useState<DriveResult | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refreshLastBackup = useCallback(async () => {
    try {
      const info = await getRemoteBackupStore().getInfo();
      if (mounted.current) setLastBackupAt(info?.modifiedAt ?? null);
    } catch (e) {
      // 表示用の取得なので失敗しても画面は止めない（オフライン時など）
      console.warn('[GoogleDrive] failed to fetch last backup time', e);
    }
  }, []);

  // 画面表示時に前回の接続を復元し、Drive 上の最終更新日時を取得する
  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    (async () => {
      const account = await restoreGoogleAccount();
      if (cancelled || !account) return;
      setEmail(account.email);
      await refreshLastBackup();
    })();
    return () => {
      cancelled = true;
    };
  }, [configured, refreshLastBackup]);

  const run = useCallback(async (kind: Exclude<DriveBusy, null>, task: () => Promise<DriveResult>) => {
    setBusy(kind);
    setResult(null);
    let outcome: DriveResult;
    try {
      outcome = await task();
    } catch (e) {
      outcome = failure(e);
    }
    if (mounted.current) {
      setResult(outcome);
      setBusy(null);
    }
  }, []);

  const connect = useCallback(
    () =>
      run('connect', async () => {
        const account = await connectGoogleAccount();
        setEmail(account.email);
        await refreshLastBackup();
        return { ok: true, text: 'Google アカウントに接続しました' };
      }),
    [run, refreshLastBackup],
  );

  const backup = useCallback(
    () =>
      run('backup', async () => {
        const info = await backupToRemote({ noteRepo: getNoteRepository(), store: getRemoteBackupStore() });
        setLastBackupAt(info.modifiedAt);
        return { ok: true, text: 'Google Drive へのバックアップが完了しました' };
      }),
    [run],
  );

  const doRestore = useCallback(
    () =>
      run('restore', async () => {
        const { created, skipped } = await restoreFromRemote(
          {
            noteRepo: getNoteRepository(),
            labelRepo: getLabelRepository(),
            store: getRemoteBackupStore(),
          },
          policy,
        );
        return { ok: true, text: `Google Drive から復元しました（作成 ${created}件 / スキップ ${skipped}件）` };
      }),
    [run, policy],
  );

  const restore = useCallback(() => {
    Alert.alert('Google Drive から復元', RESTORE_MESSAGE[policy], [
      { text: 'キャンセル', style: 'cancel' },
      { text: '復元する', style: 'destructive', onPress: () => void doRestore() },
    ]);
  }, [policy, doRestore]);

  const disconnect = useCallback(
    () =>
      run('disconnect', async () => {
        await disconnectGoogleAccount();
        setEmail(null);
        setLastBackupAt(null);
        return { ok: true, text: 'Google アカウントの接続を解除しました' };
      }),
    [run],
  );

  const confirmDisconnect = useCallback(() => {
    Alert.alert(
      '接続解除',
      'Google アカウントの接続を解除します。Google Drive 上のバックアップは削除されません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '解除する', onPress: () => void disconnect() },
      ],
    );
  }, [disconnect]);

  return {
    configured,
    email,
    lastBackupAt,
    busy,
    result,
    connect,
    backup,
    restore,
    disconnect: confirmDisconnect,
  };
}
