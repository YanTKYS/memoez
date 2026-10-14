import { useEffect, useRef } from 'react';
import { widgetBridge } from '@/lib/widget/widgetBridge';

/**
 * ホームボタン・履歴ボタンでウィンドウを離れたときの「保存して閉じる」を引き受ける。
 *
 * ネイティブ側（MemoEZWindowActivity.onUserLeaveHint）は、引き受け手がいる間は即座に
 * 画面を破棄せず onCloseRequested を送ってくるので、戻るボタン・× と同じ処理
 * （保存完了 → ウィジェット更新 → closeWindow）で閉じる。
 * 受け取ったらすぐ acknowledgeCloseRequest を返すので、ネイティブ側の時間切れ（JS 無応答時の
 * 保険）は保存の所要時間に影響しない。保存に失敗したら閉じず（keepWindowOpen）、
 * 入力内容を残したウィンドウに履歴から戻れるようにする。
 *
 * @param saveAndClose 閉じたら true、保存に失敗して入力を残したら false で解決する
 */
export function useHostCloseRequest(saveAndClose: () => Promise<boolean>): void {
  const saveAndCloseRef = useRef(saveAndClose);
  saveAndCloseRef.current = saveAndClose;

  useEffect(() => {
    const sub = widgetBridge.addCloseRequestListener(() => {
      // 受け取ったことを先に伝え、保存に時間がかかってもネイティブ側の時間切れで破棄させない
      widgetBridge.acknowledgeCloseRequest();
      saveAndCloseRef.current()
        .then((closed) => { if (!closed) widgetBridge.keepWindowOpen(); })
        .catch((e) => {
          console.error('close request error:', e);
          widgetBridge.keepWindowOpen();
        });
    });
    widgetBridge.setCloseHandlerActive(true);
    return () => {
      widgetBridge.setCloseHandlerActive(false);
      sub.remove();
    };
  }, []);
}
