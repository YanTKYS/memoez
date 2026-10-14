import { FakeNoteRepo } from '@/domain/usecases/testing/fakeRepos';
import type { WidgetBridge } from '@/lib/widget/widgetBridge';
import type { WidgetNoteSnapshot } from '@/lib/widget/widgetSnapshot';
import type { WidgetListSnapshot } from '@/lib/widget/widgetListSnapshot';
import { createWidgetSyncer, syncWidgetsOnce } from '@/lib/widget/widgetSync';

// 実 DB を開かないよう DI を差し替える（各テストでは getRepo を直接渡す）
jest.mock('@/lib/di', () => ({ getNoteRepository: () => { throw new Error('not used'); } }));

function fakeBridge(boundNoteIds: number[], available = true, hasListWidgets = false) {
  const sent: WidgetNoteSnapshot[][] = [];
  const lists: WidgetListSnapshot[] = [];
  const bridge: WidgetBridge = {
    isAvailable: () => available,
    getBoundNoteIds: () => boundNoteIds,
    updateSnapshots: async (snapshots) => { sent.push(snapshots); },
    hasListWidgets: () => hasListWidgets,
    updateListSnapshot: async (snapshot) => { lists.push(snapshot); },
    addListSyncRequestListener: () => ({ remove: () => {} }),
    completeConfiguration: async () => {},
    closeWindow: () => true,
    setCloseHandlerActive: () => {},
    keepWindowOpen: () => {},
    acknowledgeCloseRequest: () => {},
    addCloseRequestListener: () => ({ remove: () => {} }),
  };
  return { bridge, sent, lists };
}

async function repoWithNotes() {
  const repo = new FakeNoteRepo();
  const a = await repo.create({ title: 'A', content: 'a', type: 'TEXT', color: 'RED' });
  const b = await repo.create({ title: 'B', content: 'b', type: 'TEXT', color: 'BLUE' });
  return { repo, a, b };
}

describe('syncWidgetsOnce', () => {
  it('sends the current content of every note shown on the home screen (once per note)', async () => {
    const { repo, a, b } = await repoWithNotes();
    const { bridge, sent } = fakeBridge([a.id, b.id, a.id]);

    await syncWidgetsOnce({ bridge, getRepo: () => repo });

    expect(sent.length).toBe(1);
    expect(sent[0]!.map((s) => [s.noteId, s.title, s.status])).toEqual([
      [a.id, 'A', 'ok'],
      [b.id, 'B', 'ok'],
    ]);
  });

  it('reports deleted notes so their widgets show the deleted state', async () => {
    const { repo, a } = await repoWithNotes();
    await repo.delete(a.id);
    const { bridge, sent } = fakeBridge([a.id]);

    await syncWidgetsOnce({ bridge, getRepo: () => repo });

    expect(sent[0]![0]!.status).toBe('deleted');
  });

  it('does nothing without widgets or without the native module', async () => {
    const { repo, a } = await repoWithNotes();
    const none = fakeBridge([]);
    const unavailable = fakeBridge([a.id], false);

    await syncWidgetsOnce({ bridge: none.bridge, getRepo: () => repo });
    await syncWidgetsOnce({ bridge: unavailable.bridge, getRepo: () => repo });

    expect(none.sent.length).toBe(0);
    expect(unavailable.sent.length).toBe(0);
  });
});

describe('syncWidgetsOnce (4×2 list widget)', () => {
  const ids = (list: WidgetListSnapshot) => list.items.map((item) => item.noteId);

  it('sends recent notes, pinned first then newest, without archived or deleted notes', async () => {
    const repo = new FakeNoteRepo();
    const old      = await repo.create({ title: '古い',   content: '', type: 'TEXT', color: 'NONE' });
    const pinned   = await repo.create({ title: 'ピン',   content: '', type: 'TEXT', color: 'NONE' });
    const archived = await repo.create({ title: '保管',   content: '', type: 'TEXT', color: 'NONE' });
    const deleted  = await repo.create({ title: '削除',   content: '', type: 'TEXT', color: 'NONE' });
    const fresh    = await repo.create({ title: '新しい', content: '', type: 'TEXT', color: 'NONE' });
    old.updatedAt    = new Date(2026, 0, 1);
    pinned.updatedAt = new Date(2025, 0, 1);
    fresh.updatedAt  = new Date(2026, 5, 1);
    pinned.isPinned  = true;
    await repo.toggleArchive(archived.id);
    await repo.delete(deleted.id);

    const { bridge, sent, lists } = fakeBridge([], true, true);
    await syncWidgetsOnce({ bridge, getRepo: () => repo });

    expect(sent.length).toBe(0);
    expect(lists.length).toBe(1);
    expect(ids(lists[0]!)).toEqual([pinned.id, fresh.id, old.id]);
  });

  it('reflects new, edited and deleted notes on the next sync', async () => {
    const repo = new FakeNoteRepo();
    const a = await repo.create({ title: 'A', content: '', type: 'TEXT', color: 'NONE' });
    const b = await repo.create({ title: 'B', content: '', type: 'TEXT', color: 'NONE' });
    a.updatedAt = new Date(2026, 0, 1);
    b.updatedAt = new Date(2026, 0, 2);
    const { bridge, lists } = fakeBridge([], true, true);
    const sync = () => syncWidgetsOnce({ bridge, getRepo: () => repo });

    await sync();
    expect(ids(lists[0]!)).toEqual([b.id, a.id]);

    await repo.update(a.id, { title: 'A（編集）' });   // 編集で先頭へ
    const c = await repo.create({ title: 'C', content: '', type: 'TEXT', color: 'NONE' });
    c.updatedAt = new Date(2026, 0, 3);
    await repo.delete(b.id);
    await sync();

    expect(ids(lists[1]!)).toEqual([a.id, c.id]);
    expect(lists[1]!.items[0]!.title).toBe('A（編集）');
  });

  it('sends an empty list when there are no notes (the widget shows its empty state)', async () => {
    const { bridge, lists } = fakeBridge([], true, true);
    await syncWidgetsOnce({ bridge, getRepo: () => new FakeNoteRepo() });
    expect(lists[0]!.items).toEqual([]);
  });

  it('updates both kinds of widgets, and skips the list query when no list widget is placed', async () => {
    const { repo, a } = await repoWithNotes();
    const findRecent = jest.spyOn(repo, 'findRecent');

    const onlySticky = fakeBridge([a.id], true, false);
    await syncWidgetsOnce({ bridge: onlySticky.bridge, getRepo: () => repo });
    expect(onlySticky.sent.length).toBe(1);
    expect(onlySticky.lists.length).toBe(0);
    expect(findRecent).not.toHaveBeenCalled();

    const both = fakeBridge([a.id], true, true);
    await syncWidgetsOnce({ bridge: both.bridge, getRepo: () => repo });
    expect(both.sent.length).toBe(1);
    expect(both.lists.length).toBe(1);
    jest.restoreAllMocks();
  });
});

describe('createWidgetSyncer', () => {
  it('runs syncs one at a time and merges requests made while one is waiting', async () => {
    const { repo, a } = await repoWithNotes();
    const { bridge, sent } = fakeBridge([a.id]);
    const requestSync = createWidgetSyncer({ bridge, getRepo: () => repo });

    const first  = requestSync();
    const second = requestSync();
    const third  = requestSync();
    await Promise.all([first, second, third]);

    expect(sent.length).toBe(1);

    await requestSync();
    expect(sent.length).toBe(2);
  });

  it('keeps working after a failed sync', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { repo, a } = await repoWithNotes();
    const { bridge, sent } = fakeBridge([a.id]);
    let fail = true;
    const flaky: WidgetBridge = {
      ...bridge,
      updateSnapshots: async (snapshots) => {
        if (fail) { fail = false; throw new Error('binder died'); }
        await bridge.updateSnapshots(snapshots);
      },
    };
    const requestSync = createWidgetSyncer({ bridge: flaky, getRepo: () => repo });

    await requestSync();
    await requestSync();

    expect(sent.length).toBe(1);
    expect(errorSpy).toHaveBeenCalled();
    jest.restoreAllMocks();
  });
});
