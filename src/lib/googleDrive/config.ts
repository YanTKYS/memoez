/**
 * Google Drive 連携の設定。Client ID はソースに埋め込まず環境変数から読む
 * （.env.example 参照）。EXPO_PUBLIC_ 変数はビルド時にバンドルへ埋め込まれる。
 * Web Client ID は秘密情報ではない（client secret は使わない）。
 */
export const DRIVE_APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

/** appDataFolder に置くバックアップファイル名（固定・1 ファイルを上書き） */
export const BACKUP_FILE_NAME = 'memoez-backup.json';

export function getGoogleWebClientId(): string {
  return (process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '').trim();
}

export function isGoogleDriveConfigured(): boolean {
  return getGoogleWebClientId() !== '';
}
