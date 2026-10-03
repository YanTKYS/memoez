import { BackupError } from '@/domain/backup/BackupError';
import type { IRemoteBackupStore, RemoteBackupInfo } from '@/domain/backup/IRemoteBackupStore';
import type { ILabelRepository } from '@/domain/repositories/ILabelRepository';
import type { INoteRepository } from '@/domain/repositories/INoteRepository';
import {
  BackupFormatError,
  exportBackupJson,
  importBackupJson,
  type ImportPolicy,
} from './backupJson';

/**
 * 既存の JSON バックアップ（exportBackupJson）をそのままリモートへ保存する。
 * Drive 専用の形式は持たない。
 */
export async function backupToRemote(
  deps: { noteRepo: INoteRepository; store: IRemoteBackupStore },
): Promise<RemoteBackupInfo> {
  const json = await exportBackupJson(deps.noteRepo);
  return deps.store.upload(json);
}

/**
 * リモートのバックアップを既存のインポート処理へ渡して復元する。
 * 検証（JSON 解析・形式チェック）は importBackupJson 内で DB 書き込みより前に行われるため、
 * 壊れたデータでは既存データに変更が入らない。
 */
export async function restoreFromRemote(
  deps: { noteRepo: INoteRepository; labelRepo: ILabelRepository; store: IRemoteBackupStore },
  policy: ImportPolicy,
): Promise<{ created: number; skipped: number }> {
  const { json } = await deps.store.download();
  try {
    return await importBackupJson(json, { noteRepo: deps.noteRepo, labelRepo: deps.labelRepo }, policy);
  } catch (e) {
    if (e instanceof BackupFormatError) throw new BackupError('INVALID_BACKUP', e.message, e);
    throw new BackupError('UNKNOWN', 'restore failed', e);
  }
}
