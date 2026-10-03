export interface RemoteBackupInfo {
  /** リモート側のファイル更新日時 */
  modifiedAt: Date;
}

/**
 * バックアップ JSON の保存先（現状は Google Drive の appDataFolder）。
 * 失敗はすべて BackupError で投げること。
 */
export interface IRemoteBackupStore {
  /** バックアップを上書き保存する（世代管理なし） */
  upload(json: string): Promise<RemoteBackupInfo>;
  /** バックアップ本文を取得する。無ければ BackupError('NO_BACKUP') */
  download(): Promise<{ json: string } & RemoteBackupInfo>;
  /** バックアップが無ければ null */
  getInfo(): Promise<RemoteBackupInfo | null>;
}
