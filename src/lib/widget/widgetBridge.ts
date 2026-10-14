import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import type { WidgetNoteSnapshot } from './widgetSnapshot';

export interface Subscription {
  remove(): void;
}

/** modules/memoez-widget（MemoEZWidgetModule.kt）の JS 側インターフェース */
interface MemoEZWidgetNativeModule {
  getBoundNoteIds(): number[];
  updateSnapshots(snapshotsJson: string): Promise<void>;
  completeConfiguration(appWidgetId: number, noteId: number, snapshotJson: string): Promise<void>;
  closeWindow(): boolean;
  setCloseHandlerActive(active: boolean): void;
  keepWindowOpen(): void;
  acknowledgeCloseRequest(): void;
  addListener(eventName: 'onCloseRequested', listener: () => void): Subscription;
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
  /** ウィジェットから開いたウィンドウを閉じてホーム画面に戻る（閉じる対象があれば true） */
  closeWindow(): boolean;
  /**
   * 編集ウィンドウが「閉じる前の保存」を引き受けるかをネイティブに伝える。
   * 引き受け中は、ホームボタン等で離れたときに即座に閉じず onCloseRequested を送ってくる。
   */
  setCloseHandlerActive(active: boolean): void;
  /** ホームボタン・履歴ボタンでウィンドウを離れたとき（保存してから closeWindow() を呼ぶ） */
  addCloseRequestListener(listener: () => void): Subscription;
  /**
   * 閉じる依頼を受け取ったことを伝える。ネイティブ側は「JS が応答しない」場合の時間切れを
   * 取り消し、保存に時間がかかっても結果（closeWindow / keepWindowOpen）を待つ。
   */
  acknowledgeCloseRequest(): void;
  /**
   * 閉じる依頼に応じられなかった（保存に失敗した）ことを伝える。ネイティブ側は時間切れによる
   * 破棄を取り消し、入力内容を残したウィンドウに履歴から戻れるようにする。
   */
  keepWindowOpen(): void;
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
  setCloseHandlerActive: (active) => { native?.setCloseHandlerActive(active); },
  keepWindowOpen: () => { native?.keepWindowOpen(); },
  acknowledgeCloseRequest: () => { native?.acknowledgeCloseRequest(); },
  addCloseRequestListener: (listener) =>
    native?.addListener('onCloseRequested', listener) ?? { remove: () => {} },
};
