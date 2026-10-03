/**
 * 依存性注入の唯一のエントリポイント。
 * 具体的な Repository クラスを知るのはここだけ。
 * テスト時はこのファイルをモックに差し替える。
 */
import { getDb } from '@/data/db/client';
import { DrizzleNoteRepository } from '@/data/repositories/DrizzleNoteRepository';
import { DrizzleLabelRepository } from '@/data/repositories/DrizzleLabelRepository';
import { GoogleDriveBackupStore } from '@/data/backup/GoogleDriveBackupStore';
import type { IRemoteBackupStore } from '@/domain/backup/IRemoteBackupStore';
import { DriveClient } from '@/lib/googleDrive/driveClient';
import { getDriveAccessToken, invalidateAccessToken } from '@/lib/googleDrive/googleAuth';

export function getNoteRepository(): DrizzleNoteRepository {
  return new DrizzleNoteRepository(getDb());
}

export function getLabelRepository(): DrizzleLabelRepository {
  return new DrizzleLabelRepository(getDb());
}

/** Google Drive バックアップ先。接続は任意機能で、使われるまで認証 API には触れない */
export function getRemoteBackupStore(): IRemoteBackupStore {
  const client = new DriveClient({
    getAccessToken: getDriveAccessToken,
    invalidateAccessToken,
  });
  return new GoogleDriveBackupStore(client);
}
