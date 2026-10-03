/**
 * クラウド（Google Drive）バックアップで起こり得る失敗の分類。
 * 画面には code に対応する短いメッセージだけを出し、詳細は cause とログに残す。
 */
export type BackupErrorCode =
  | 'NOT_CONFIGURED' // Client ID 等が未設定のビルド
  | 'NOT_CONNECTED' // Google アカウント未接続
  | 'AUTH_CANCELLED' // 認証ダイアログをユーザーが閉じた
  | 'AUTH_EXPIRED' // 認証切れ。再接続が必要
  | 'NETWORK' // 通信不可
  | 'API' // Drive API が失敗（権限・容量・サーバー側エラー等）
  | 'NO_BACKUP' // appDataFolder にバックアップが無い
  | 'INVALID_BACKUP' // JSON 破損・形式不正
  | 'UNKNOWN';

export class BackupError extends Error {
  readonly code: BackupErrorCode;
  readonly cause?: unknown;

  constructor(code: BackupErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'BackupError';
    this.code = code;
    this.cause = cause;
  }
}

const USER_MESSAGES: Record<BackupErrorCode, string> = {
  NOT_CONFIGURED: 'このアプリでは Google Drive バックアップを利用できません',
  NOT_CONNECTED: 'Google アカウントに接続してください',
  AUTH_CANCELLED: 'Google アカウントへの接続がキャンセルされました',
  AUTH_EXPIRED: 'Google アカウントの認証が切れました。もう一度接続してください',
  NETWORK: 'ネットワークに接続できません。通信状況を確認してください',
  API: 'Google Drive との通信に失敗しました。時間をおいて再度お試しください',
  NO_BACKUP: 'Google Drive にバックアップがありません。先にバックアップしてください',
  INVALID_BACKUP: 'Google Drive のバックアップを読み込めませんでした（データが破損している可能性があります）',
  UNKNOWN: '予期しないエラーが発生しました',
};

/** 画面表示用の文言。HTTP ステータスや例外メッセージは含めない */
export function toUserMessage(error: unknown): string {
  if (error instanceof BackupError) return USER_MESSAGES[error.code];
  return USER_MESSAGES.UNKNOWN;
}
