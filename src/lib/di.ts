/**
 * 依存性注入の唯一のエントリポイント。
 * 具体的な Repository クラスを知るのはここだけ。
 * テスト時はこのファイルをモックに差し替える。
 */
import { getDb } from '@/data/db/client';
import { DrizzleNoteRepository } from '@/data/repositories/DrizzleNoteRepository';
import { DrizzleLabelRepository } from '@/data/repositories/DrizzleLabelRepository';
import { ChangeNotifyingNoteRepository } from '@/data/repositories/ChangeNotifyingNoteRepository';
import type { INoteRepository } from '@/domain/repositories/INoteRepository';
import { notifyNotesChanged } from '@/lib/noteChangeEvents';
import { GoogleDriveBackupStore } from '@/data/backup/GoogleDriveBackupStore';
import type { IRemoteBackupStore } from '@/domain/backup/IRemoteBackupStore';
import { DriveClient } from '@/lib/googleDrive/driveClient';
import { getDriveAccessToken, invalidateAccessToken } from '@/lib/googleDrive/googleAuth';

/**
 * 書き込みのたびに変更通知（noteChangeEvents）を出す。
 * 通常画面・フローティングエディタ・ウィジェット表示の同期はこの通知に依存する。
 */
export function getNoteRepository(): INoteRepository {
  return new ChangeNotifyingNoteRepository(new DrizzleNoteRepository(getDb()), notifyNotesChanged);
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
