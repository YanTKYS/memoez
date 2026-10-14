import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { FakeNoteRepo } from '@/domain/usecases/testing/fakeRepos';
import { useEditNote } from '@/ui/hooks/useEditNote';
import { exitWidgetWindow } from '@/ui/widget/closeWidgetWindow';
import { useHostCloseRequest } from '@/ui/widget/useHostCloseRequest';

// 通常画面・ウィンドウ共通の「変更通知付き Repository」をインメモリで再現する
jest.mock('@/lib/di', () => {
  const { FakeNoteRepo: Repo } = require('@/domain/usecases/testing/fakeRepos');
  const { ChangeNotifyingNoteRepository } = require('@/data/repositories/ChangeNotifyingNoteRepository');
  const { notifyNotesChanged } = require('@/lib/noteChangeEvents');
  const inner = new Repo();
  return {
    mockInner: inner,
    getNoteRepository: () => new ChangeNotifyingNoteRepository(inner, notifyNotesChanged),
    getLabelRepository: () => ({ findAll: async () => [] }),
  };
});

// ネイティブモジュール（MemoEZWidgetModule）の代わり。呼ばれた順序を記録する
jest.mock('@/lib/widget/widgetBridge', () => {
  const state = {
    log: [] as string[],
    boundNoteIds: [] as number[],
    closeHandlerActive: false,
    listener: null as null | (() => void),
  };
  return {
    mockState: state,
    widgetBridge: {
      isAvailable: () => true,
      getBoundNoteIds: () => state.boundNoteIds,
      hasListWidgets: () => false,
      updateSnapshots: async (snapshots: { body: string }[]) => {
        state.log.push(`snapshot:${snapshots[0]?.body}`);
      },
      completeConfiguration: async () => {},
      closeWindow: () => { state.log.push('close'); return true; },
      setCloseHandlerActive: (active: boolean) => { state.closeHandlerActive = active; },
      keepWindowOpen: () => { state.log.push('keep-open'); },
      acknowledgeCloseRequest: () => { state.log.push('ack'); },
      addCloseRequestListener: (listener: () => void) => {
        state.listener = listener;
        return { remove: () => { state.listener = null; } };
      },
    },
  };
});

/* eslint-disable @typescript-eslint/no-require-imports */
const di = require('@/lib/di') as { mockInner: FakeNoteRepo };
const bridge = require('@/lib/widget/widgetBridge') as {
  mockState: { log: string[]; boundNoteIds: number[]; closeHandlerActive: boolean; listener: null | (() => void) };
};
/* eslint-enable @typescript-eslint/no-require-imports */

/** フローティングエディタと同じ組み合わせ（useEditNote + onExit=exitWidgetWindow + ホームボタン対応） */
async function openFloatingEditor() {
  const note = await di.mockInner.create({ title: '付箋', content: '元の本文', type: 'TEXT', color: 'YELLOW' });
  bridge.mockState.boundNoteIds = [note.id];
  const hook = renderHook(() => {
    const editor = useEditNote(note.id, { onExit: exitWidgetWindow });
    useHostCloseRequest(editor.handleBack);
    return editor;
  });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return { id: note.id, ...hook };
}

describe('closing the widget window from the home / recents button', () => {
  beforeEach(() => { bridge.mockState.log = []; });

  it('takes over the close only while the editor is shown', async () => {
    const { unmount } = await openFloatingEditor();
    expect(bridge.mockState.closeHandlerActive).toBe(true);

    unmount();
    // 引き受け手がいなければ、ネイティブ側はそのまま閉じる
    expect(bridge.mockState.closeHandlerActive).toBe(false);
    expect(bridge.mockState.listener).toBeNull();
  });

  it('saves the text typed just before, updates the widget, and only then closes', async () => {
    const { id, result, unmount } = await openFloatingEditor();

    act(() => result.current.setContent('ホームボタン直前の入力'));
    // MemoEZWindowActivity.onUserLeaveHint → onCloseRequested（自動保存の待ち時間内）
    act(() => bridge.mockState.listener?.());

    await waitFor(() => expect(bridge.mockState.log).toContain('close'));
    expect((await di.mockInner.findById(id))?.content).toBe('ホームボタン直前の入力');

    // 受領をすぐ返し（ネイティブの時間切れを止める）、保存後の内容でウィジェットを更新してから閉じる
    expect(bridge.mockState.log[0]).toBe('ack');
    const closeAt = bridge.mockState.log.indexOf('close');
    const snapshotAt = bridge.mockState.log.lastIndexOf('snapshot:ホームボタン直前の入力');
    expect(snapshotAt >= 0 && snapshotAt < closeAt).toBe(true);
    unmount();
  });

  it('keeps the window (and the input) when the save fails, instead of letting the timeout close it', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const { id, result, unmount } = await openFloatingEditor();
    jest.spyOn(di.mockInner, 'update').mockImplementationOnce(async () => { throw new Error('disk full'); });

    act(() => result.current.setContent('保存できなかった入力'));
    act(() => bridge.mockState.listener?.());

    await waitFor(() => expect(bridge.mockState.log).toContain('keep-open'));
    expect(bridge.mockState.log).not.toContain('close');
    expect(result.current.form.content).toBe('保存できなかった入力');
    expect(result.current.saveError).toBe(true);

    // 次に離れたとき（または戻る・×）に再試行し、保存できたら閉じる
    act(() => bridge.mockState.listener?.());
    await waitFor(() => expect(bridge.mockState.log).toContain('close'));
    expect((await di.mockInner.findById(id))?.content).toBe('保存できなかった入力');

    jest.restoreAllMocks();
    unmount();
  });

  it('closes once even if the request arrives again while saving', async () => {
    const { result, unmount } = await openFloatingEditor();

    act(() => result.current.setContent('連打'));
    act(() => {
      bridge.mockState.listener?.();
      bridge.mockState.listener?.();
    });

    await waitFor(() => expect(bridge.mockState.log).toContain('close'));
    expect(bridge.mockState.log.filter((entry) => entry === 'close').length).toBe(1);
    unmount();
  });
});
