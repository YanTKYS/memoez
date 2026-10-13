import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import type { WidgetNoteSnapshot } from './widgetSnapshot';

/** modules/memoez-widget（MemoEZWidgetModule.kt）の JS 側インターフェース */
interface MemoEZWidgetNativeModule {
  getBoundNoteIds(): number[];
  updateSnapshots(snapshotsJson: string): Promise<void>;
  completeConfiguration(appWidgetId: number, noteId: number, snapshotJson: string): Promise<void>;
  closeWindow(): boolean;
}

export interface WidgetBridge {
  /** ウィジェット機能が使えるか（Android のネイティブモジュールが組み込まれているか） */
  isAvailable(): boolean;
  /** ホーム画面のウィジェットが表示しているメモの ID */
  getBoundNoteIds(): number[];
  /** 表示内容を更新する（内容が変わったウィジェットだけ描画し直される） */
  updateSnapshots(snapshots: WidgetNoteSnapshot[]): Promise<void>;
  /** ウィジェットに表示するメモを確定し、メモ選択ウィンドウを閉じる */
  completeConfiguration(appWidgetId: number, snapshot: WidgetNoteSnapshot): Promise<void>;
  /** ウィジェットから開いたウィンドウを閉じてホーム画面に戻る */
  closeWindow(): boolean;
}

const native: MemoEZWidgetNativeModule | null =
  Platform.OS === 'android'
    ? requireOptionalNativeModule<MemoEZWidgetNativeModule>('MemoEZWidget')
    : null;

export const widgetBridge: WidgetBridge = {
  isAvailable: () => native !== null,
  getBoundNoteIds: () => native?.getBoundNoteIds() ?? [],
  updateSnapshots: async (snapshots) => {
    if (!native || snapshots.length === 0) return;
    await native.updateSnapshots(JSON.stringify(snapshots));
  },
  completeConfiguration: async (appWidgetId, snapshot) => {
    if (!native) return;
    await native.completeConfiguration(appWidgetId, snapshot.noteId, JSON.stringify(snapshot));
  },
  closeWindow: () => native?.closeWindow() ?? false,
};
