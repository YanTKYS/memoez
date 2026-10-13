/**
 * メモの変更通知（同一 JS ランタイム内の pub/sub）。
 *
 * 通常の MemoEZ 画面とホーム画面ウィジェットのフローティングエディタは
 * 同じ JS ランタイムを共有するため、どちらかで保存した内容を
 * もう一方の画面・ウィジェット表示へ反映するために使う。
 *
 * 自動保存やバックアップ復元では短時間に大量の変更が起きるため、
 * 通知は COALESCE_MS の間まとめてから 1 回だけ配信する。
 */

type Listener = () => void;

const COALESCE_MS = 150;

const listeners = new Set<Listener>();
let pending: ReturnType<typeof setTimeout> | null = null;

function dispatch(): void {
  pending = null;
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch (e) {
      console.error('note change listener error:', e);
    }
  }
}

/** メモが変更されたことを通知する（短時間の連続呼び出しは 1 回にまとめる） */
export function notifyNotesChanged(): void {
  if (pending) return;
  pending = setTimeout(dispatch, COALESCE_MS);
}

/** 変更通知を購読する。戻り値の関数で購読を解除する */
export function subscribeNotesChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
