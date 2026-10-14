import { FakeNoteRepo } from '@/domain/usecases/testing/fakeRepos';
import type { WidgetBridge } from '@/lib/widget/widgetBridge';
import type { WidgetNoteSnapshot } from '@/lib/widget/widgetSnapshot';
import { createWidgetSyncer, syncWidgetsOnce } from '@/lib/widget/widgetSync';

// 実 DB を開かないよう DI を差し替える（各テストでは getRepo を直接渡す）
jest.mock('@/lib/di', () => ({ getNoteRepository: () => { throw new Error('not used'); } }));

function fakeBridge(boundNoteIds: number[], available = true) {
  const sent: WidgetNoteSnapshot[][] = [];
  const bridge: WidgetBridge = {
    isAvailable: () => available,
    getBoundNoteIds: () => boundNoteIds,
    updateSnapshots: async (snapshots) => { sent.push(snapshots); },
    completeConfiguration: async () => {},
    closeWindow: () => true,
    setCloseHandlerActive: () => {},
    addCloseRequestListener: () => ({ remove: () => {} }),
  };
  return { bridge, sent };
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
