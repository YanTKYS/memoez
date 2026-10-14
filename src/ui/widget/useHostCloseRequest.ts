import { useEffect, useRef } from 'react';
import { widgetBridge } from '@/lib/widget/widgetBridge';

/**
 * ホームボタン・履歴ボタンでウィンドウを離れたときの「保存して閉じる」を引き受ける。
 *
 * ネイティブ側（MemoEZWindowActivity.onUserLeaveHint）は、引き受け手がいる間は即座に
 * 画面を破棄せず onCloseRequested を送ってくるので、戻るボタン・× と同じ処理
 * （保存完了 → ウィジェット更新 → closeWindow）で閉じる。
 */
export function useHostCloseRequest(saveAndClose: () => void): void {
  const saveAndCloseRef = useRef(saveAndClose);
  saveAndCloseRef.current = saveAndClose;

  useEffect(() => {
    const sub = widgetBridge.addCloseRequestListener(() => saveAndCloseRef.current());
    widgetBridge.setCloseHandlerActive(true);
    return () => {
      widgetBridge.setCloseHandlerActive(false);
      sub.remove();
    };
  }, []);
}
