import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

export const RELEASES_PAGE = 'https://github.com/YanTKYS/memoez/releases';
export interface InstalledInfo { versionName: string; versionCode: number; debuggable: boolean }
export interface ReleaseOffer { versionName: string; versionCode: number; page: string; notes: string; size: number }
export interface UpdateCheck {
  status: 'available' | 'current' | 'older' | 'unsupported' | 'blocked' | 'none';
  release: ReleaseOffer | null;
  reason: string | null;
  versionName: string | null;
  page: string | null;
}
export interface UpdateProgress { phase: 'downloading' | 'verifying'; bytes: number; total: number }
interface Subscription { remove(): void }
interface NativeUpdates {
  getInstalled(): InstalledInfo;
  canInstall(): boolean;
  check(): Promise<UpdateCheck>;
  download(): Promise<boolean>;
  install(): Promise<boolean>;
  openPermission(): Promise<boolean>;
  cancel(): void;
  discard(): void;
  addListener(event: 'onUpdateProgress', listener: (progress: UpdateProgress) => void): Subscription;
  addListener(event: 'onUpdateInstallerResult', listener: (result: { completed: boolean }) => void): Subscription;
}
const native = Platform.OS === 'android' ? requireOptionalNativeModule<NativeUpdates>('MemoEZUpdates') : null;
function moduleOrThrow(): NativeUpdates {
  if (!native) throw Object.assign(new Error('unavailable'), { code: 'unavailable' });
  return native;
}
export const updatesBridge = {
  installed: (): InstalledInfo => moduleOrThrow().getInstalled(),
  canInstall: (): boolean => native?.canInstall() ?? false,
  check: (): Promise<UpdateCheck> => moduleOrThrow().check(),
  download: (): Promise<boolean> => moduleOrThrow().download(),
  install: (): Promise<boolean> => moduleOrThrow().install(),
  openPermission: (): Promise<boolean> => moduleOrThrow().openPermission(),
  cancel: (): void => { native?.cancel(); },
  discard: (): void => { native?.discard(); },
  onProgress: (listener: (progress: UpdateProgress) => void): Subscription => native?.addListener('onUpdateProgress', listener) ?? { remove() {} },
  onInstaller: (listener: (result: { completed: boolean }) => void): Subscription => native?.addListener('onUpdateInstallerResult', listener) ?? { remove() {} },
};
