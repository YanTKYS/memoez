import type { INoteRepository } from '@/domain/repositories/INoteRepository';
import { getNoteRepository } from '@/lib/di';
import { subscribeNotesChanged } from '@/lib/noteChangeEvents';
import { widgetBridge, type WidgetBridge } from './widgetBridge';
import { buildWidgetSnapshot } from './widgetSnapshot';

export interface WidgetSyncDeps {
  bridge:  WidgetBridge;
  getRepo: () => INoteRepository;
}

const defaultDeps: WidgetSyncDeps = { bridge: widgetBridge, getRepo: getNoteRepository };

/**
 * ホーム画面のウィジェットが表示しているメモを SQLite から読み直し、表示内容を更新する。
 * 削除済み（見つからない）メモは「削除されました」表示になる。
 */
export async function syncWidgetsOnce(deps: WidgetSyncDeps = defaultDeps): Promise<void> {
  const { bridge, getRepo } = deps;
  if (!bridge.isAvailable()) return;

  const noteIds = [...new Set(bridge.getBoundNoteIds())];
  if (noteIds.length === 0) return;

  const repo = getRepo();
  const snapshots = await Promise.all(
    noteIds.map(async (id) => buildWidgetSnapshot(id, await repo.findById(id))),
  );
  await bridge.updateSnapshots(snapshots);
}

/**
 * 同期を直列化し、実行待ちが既にあれば相乗りさせる
 * （自動保存のたびに同期が積み上がらないようにする）。
 */
export function createWidgetSyncer(deps: WidgetSyncDeps = defaultDeps) {
  let chain: Promise<void> = Promise.resolve();
  let queued: Promise<void> | null = null;

  return function requestSync(): Promise<void> {
    if (queued) return queued;
    const run = chain
      .then(() => {
        queued = null;
        return syncWidgetsOnce(deps);
      })
      .catch((e) => console.error('widget sync error:', e));
    queued = run;
    chain = run;
    return run;
  };
}

const requestWidgetSync = createWidgetSyncer();
let started = false;

/**
 * 今すぐウィジェットを同期し、完了まで待つ。
 * 変更通知はタイマーでまとめて配信するが、Android ではアプリがバックグラウンドの間
 * JS のタイマーが止まるため、ウィンドウを閉じる直前はこちらで同期を済ませておく。
 */
export function syncWidgetsNow(): Promise<void> {
  return requestWidgetSync();
}

/**
 * メモの変更通知を購読してウィジェットへ反映する。DB 初期化後に呼ぶ（2 回目以降は何もしない）。
 * 起動時にも 1 回同期し、前回終了時に反映しきれなかった差分を埋める。
 */
export function startWidgetSync(): void {
  if (started || !widgetBridge.isAvailable()) return;
  started = true;
  subscribeNotesChanged(() => { requestWidgetSync(); });
  requestWidgetSync();
}
