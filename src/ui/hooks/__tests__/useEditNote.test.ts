import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { FakeNoteRepo } from '@/domain/usecases/testing/fakeRepos';
import type { INoteRepository } from '@/domain/repositories/INoteRepository';
import { useEditNote } from '@/ui/hooks/useEditNote';

// 通常画面とウィジェットのフローティングエディタが共有する「変更通知付き Repository」を
// インメモリの Fake で再現する（実アプリの di.ts と同じ組み立て）
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

// eslint-disable-next-line @typescript-eslint/no-require-imports
const di = require('@/lib/di') as { mockInner: FakeNoteRepo; getNoteRepository: () => INoteRepository };

/** 別の画面（もう一方のエディタ）からの書き込み */
const otherScreen = () => di.getNoteRepository();

async function openEditor(title: string) {
  const created = await di.mockInner.create({ title, content: 'body', type: 'TEXT', color: 'NONE' });
  const onExit = jest.fn();
  const hook = renderHook(() => useEditNote(created.id, { onExit }));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return { id: created.id, onExit, ...hook };
}

/** 変更通知（150ms でまとめて配信）と読み直しが終わるのを待つ */
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 400)));

describe('useEditNote', () => {
  it('reloads the note when another screen saved it and nothing is being edited here', async () => {
    const { id, result, unmount } = await openEditor('元のタイトル');

    await otherScreen().update(id, { title: 'ウィジェットで編集' });
    await waitFor(() => expect(result.current.form.title).toBe('ウィジェットで編集'));

    unmount();
  });

  it('keeps what the user is typing instead of overwriting it with the other screen', async () => {
    const { id, result, unmount } = await openEditor('元のタイトル');

    act(() => result.current.setTitle('入力中'));
    await otherScreen().update(id, { title: '別画面の変更' });
    await settle();

    expect(result.current.form.title).toBe('入力中');
    unmount();
  });

  it('stops editing (and never re-saves) when the note was deleted elsewhere', async () => {
    const { id, result, unmount } = await openEditor('消されるメモ');

    await otherScreen().delete(id);
    await waitFor(() => expect(result.current.loadError).toBe('このメモは削除されました'));

    act(() => result.current.setTitle('削除後の入力'));
    unmount();
    await settle();
    expect(await di.mockInner.findById(id)).toBeNull();
  });

  it('saves the last keystrokes when the screen goes away before the autosave delay', async () => {
    const { id, result, unmount } = await openEditor('タイトル');

    act(() => result.current.setContent('閉じる直前の入力'));
    unmount();

    await waitFor(async () => expect((await di.mockInner.findById(id))?.content).toBe('閉じる直前の入力'));
  });

  it('does not close when the save fails, keeps the input, and closes after a successful retry', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { id, result, onExit, unmount } = await openEditor('タイトル');
    jest.spyOn(di.mockInner, 'update').mockImplementationOnce(async () => { throw new Error('disk full'); });

    act(() => result.current.setContent('失いたくない入力'));
    let closed: boolean | undefined;
    await act(async () => { closed = await result.current.handleBack(); });

    expect(closed).toBe(false);
    expect(onExit).not.toHaveBeenCalled();
    expect(result.current.form.content).toBe('失いたくない入力');
    expect(result.current.saveError).toBe(true);
    expect((await di.mockInner.findById(id))?.content).toBe('body');

    // もう一度閉じると保存を再試行し、成功したら閉じる
    await act(async () => { closed = await result.current.handleBack(); });
    expect(closed).toBe(true);
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(result.current.saveError).toBe(false);
    expect((await di.mockInner.findById(id))?.content).toBe('失いたくない入力');

    expect(errorSpy).toHaveBeenCalled();
    jest.restoreAllMocks();
    unmount();
  });

  it('lets the user explicitly discard unsaved changes when saving keeps failing', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const { id, result, onExit, unmount } = await openEditor('タイトル');
    jest.spyOn(di.mockInner, 'update').mockImplementation(async () => { throw new Error('disk full'); });

    act(() => result.current.setContent('保存できない入力'));
    await act(async () => { await result.current.handleBack(); });
    expect(onExit).not.toHaveBeenCalled();

    act(() => result.current.discardChangesAndExit());
    expect(onExit).toHaveBeenCalledTimes(1);

    jest.restoreAllMocks();
    unmount();
    await settle();
    // 破棄を選んだので、閉じた後に古い入力で上書きしない
    expect((await di.mockInner.findById(id))?.content).toBe('body');
  });

  it('closes only after the pending save has been written', async () => {
    const { id, result, onExit, unmount } = await openEditor('タイトル');

    act(() => result.current.setContent('保存してから閉じる'));
    await act(async () => { result.current.handleBack(); });

    await waitFor(() => expect(onExit).toHaveBeenCalledTimes(1));
    expect((await di.mockInner.findById(id))?.content).toBe('保存してから閉じる');
    unmount();
  });
});
