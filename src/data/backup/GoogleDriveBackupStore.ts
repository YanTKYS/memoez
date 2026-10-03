import { BackupError } from '@/domain/backup/BackupError';
import type { IRemoteBackupStore, RemoteBackupInfo } from '@/domain/backup/IRemoteBackupStore';
import { BACKUP_FILE_NAME } from '@/lib/googleDrive/config';
import type { DriveClient, DriveFileMeta } from '@/lib/googleDrive/driveClient';

function toInfo(meta: DriveFileMeta): RemoteBackupInfo {
  const modifiedAt = new Date(meta.modifiedTime);
  if (Number.isNaN(modifiedAt.getTime())) {
    throw new BackupError('API', 'invalid modifiedTime in drive response');
  }
  return { modifiedAt };
}

/** Google Drive の appDataFolder 上の memoez-backup.json 1 ファイルを保存先とする実装 */
export class GoogleDriveBackupStore implements IRemoteBackupStore {
  constructor(private readonly client: DriveClient) {}

  async upload(json: string): Promise<RemoteBackupInfo> {
    const existing = await this.client.findFile(BACKUP_FILE_NAME);
    const meta = existing
      ? await this.client.updateFile(existing.id, json)
      : await this.client.createFile(BACKUP_FILE_NAME, json);
    return toInfo(meta);
  }

  async download(): Promise<{ json: string } & RemoteBackupInfo> {
    const meta = await this.client.findFile(BACKUP_FILE_NAME);
    if (!meta) throw new BackupError('NO_BACKUP', 'backup file not found');
    const json = await this.client.downloadFile(meta.id);
    if (json === null) throw new BackupError('NO_BACKUP', 'backup file disappeared');
    return { json, ...toInfo(meta) };
  }

  async getInfo(): Promise<RemoteBackupInfo | null> {
    const meta = await this.client.findFile(BACKUP_FILE_NAME);
    return meta ? toInfo(meta) : null;
  }
}
