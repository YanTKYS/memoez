import { BackHandler } from 'react-native';
import { widgetBridge } from '@/lib/widget/widgetBridge';

/** ウィジェットから開いたウィンドウを閉じてホーム画面に戻る */
export function closeWidgetWindow(): void {
  if (!widgetBridge.closeWindow()) {
    // ネイティブモジュールが使えない場合でも、Activity の既定の戻る動作で閉じる
    BackHandler.exitApp();
  }
}
