import { BackHandler } from 'react-native';
import { widgetBridge } from '@/lib/widget/widgetBridge';
import { syncWidgetsNow } from '@/lib/widget/widgetSync';

/** ウィジェットから開いたウィンドウを閉じてホーム画面に戻る */
export function closeWidgetWindow(): void {
  if (widgetBridge.isAvailable()) {
    // 開いているウィンドウだけを閉じる（MemoEZ 本体が前面にあっても本体は閉じない）
    widgetBridge.closeWindow();
    return;
  }
  // ネイティブモジュールが使えない場合でも、Activity の既定の戻る動作で閉じる
  BackHandler.exitApp();
}

/**
 * 編集を終えてウィンドウを閉じる（EditNoteScreen の onExit。保存完了後に呼ばれる）。
 * 閉じた後はアプリがバックグラウンドになり JS のタイマーが止まるため、
 * 保存結果のウィジェットへの反映を待ってから閉じる。
 */
export async function exitWidgetWindow(): Promise<void> {
  try {
    await syncWidgetsNow();
  } catch (e) {
    console.error('widget sync before close error:', e);
  }
  closeWidgetWindow();
}
