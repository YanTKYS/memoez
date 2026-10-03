import { Platform } from 'react-native';
import { BackupError } from '@/domain/backup/BackupError';
import { DRIVE_APPDATA_SCOPE, getGoogleWebClientId, isGoogleDriveConfigured } from './config';

export interface GoogleAccount {
  email: string;
}

type Sdk = typeof import('@react-native-google-signin/google-signin');

let sdk: Sdk | null = null;
let configured = false;

/**
 * ネイティブモジュールを持つ SDK は初回利用時に読み込む。
 * 起動時（di.ts 経由）に読み込むと、ネイティブ側が無いビルドでは Google Drive と無関係な画面まで
 * 落ちるため、連携が使われるまで触れない。
 */
async function loadSdk(): Promise<Sdk> {
  if (Platform.OS !== 'android' || !isGoogleDriveConfigured()) {
    throw new BackupError('NOT_CONFIGURED', 'Google Drive is not configured');
  }
  if (!sdk) {
    try {
      // 意図的な遅延 require（上記コメント参照）
      sdk = require('@react-native-google-signin/google-signin') as Sdk;
    } catch (e) {
      console.warn('[GoogleDrive] failed to load sign-in module', e);
      throw new BackupError('NOT_CONFIGURED', 'sign-in module unavailable', e);
    }
  }
  if (!configured) {
    sdk.GoogleSignin.configure({
      webClientId: getGoogleWebClientId(),
      scopes: [DRIVE_APPDATA_SCOPE],
    });
    configured = true;
  }
  return sdk;
}

function isNetworkFailure(e: unknown): boolean {
  const message = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
  return /network|timeout|timed out|unable to resolve/i.test(message);
}

/** 保存済みの接続（前回のサインイン）を、ユーザー操作なしで復元する。無ければ null */
export async function restoreGoogleAccount(): Promise<GoogleAccount | null> {
  if (Platform.OS !== 'android' || !isGoogleDriveConfigured()) return null;
  try {
    const { GoogleSignin } = await loadSdk();
    if (!GoogleSignin.hasPreviousSignIn()) return null;
    const result = await GoogleSignin.signInSilently();
    if (result.type !== 'success') return null;
    return { email: result.data.user.email };
  } catch (e) {
    // オフライン等でも画面は開けるようにする。接続状態は不明として扱う
    console.warn('[GoogleDrive] restore account failed', e);
    try {
      const { GoogleSignin } = await loadSdk();
      const current = GoogleSignin.getCurrentUser();
      return current ? { email: current.user.email } : null;
    } catch {
      return null;
    }
  }
}

/** Google アカウントへ接続する（アカウント選択 + drive.appdata の同意） */
export async function connectGoogleAccount(): Promise<GoogleAccount> {
  const { GoogleSignin, isErrorWithCode, statusCodes } = await loadSdk();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const result = await GoogleSignin.signIn();
    if (result.type !== 'success') {
      throw new BackupError('AUTH_CANCELLED', 'sign-in cancelled');
    }
    if (!result.data.scopes.includes(DRIVE_APPDATA_SCOPE)) {
      // 同意画面でバックアップ用の権限が許可されなかった
      await GoogleSignin.signOut().catch(() => undefined);
      throw new BackupError('AUTH_CANCELLED', 'drive.appdata scope not granted');
    }
    return { email: result.data.user.email };
  } catch (e) {
    if (e instanceof BackupError) throw e;
    console.warn('[GoogleDrive] sign-in failed', e);
    if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new BackupError('AUTH_CANCELLED', 'sign-in cancelled', e);
    }
    if (isNetworkFailure(e)) throw new BackupError('NETWORK', 'network error', e);
    throw new BackupError('API', 'sign-in failed', e);
  }
}

/** 接続解除。端末側のサインイン状態を消し、アプリに与えた権限も取り消す */
export async function disconnectGoogleAccount(): Promise<void> {
  const { GoogleSignin } = await loadSdk();
  try {
    await GoogleSignin.revokeAccess();
  } catch (e) {
    // 取り消しに失敗（オフライン等）しても、端末側の接続は必ず解除する
    console.warn('[GoogleDrive] revokeAccess failed', e);
  }
  try {
    await GoogleSignin.signOut();
  } catch (e) {
    console.warn('[GoogleDrive] signOut failed', e);
    throw new BackupError('UNKNOWN', 'sign-out failed', e);
  }
}

/** Drive API 用のアクセストークンを取得する（期限切れ時は Play Services が更新する） */
export async function getDriveAccessToken(): Promise<string> {
  const { GoogleSignin } = await loadSdk();
  if (!GoogleSignin.hasPreviousSignIn()) {
    throw new BackupError('NOT_CONNECTED', 'not signed in');
  }
  try {
    const { accessToken } = await GoogleSignin.getTokens();
    return accessToken;
  } catch (e) {
    console.warn('[GoogleDrive] getTokens failed', e);
    if (isNetworkFailure(e)) throw new BackupError('NETWORK', 'network error', e);
    throw new BackupError('AUTH_EXPIRED', 'could not get access token', e);
  }
}

/** 401 を受けたトークンをキャッシュから破棄し、次回取得で更新させる */
export async function invalidateAccessToken(token: string): Promise<void> {
  try {
    const { GoogleSignin } = await loadSdk();
    await GoogleSignin.clearCachedAccessToken(token);
  } catch (e) {
    console.warn('[GoogleDrive] clearCachedAccessToken failed', e);
  }
}
