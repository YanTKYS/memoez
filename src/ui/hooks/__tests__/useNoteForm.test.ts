import { act, renderHook } from '@testing-library/react-native';
import { useNoteForm } from '@/ui/hooks/useNoteForm';

describe('useNoteForm.isEmpty', () => {
  it('is empty while nothing has been typed', () => {
    const { result } = renderHook(() => useNoteForm());
    expect(result.current.isEmpty()).toBe(true);
  });

  it('is not empty once the body has text', () => {
    const { result } = renderHook(() => useNoteForm());
    act(() => result.current.setContent('打ち合わせメモ'));
    expect(result.current.isEmpty()).toBe(false);
  });

  it('counts checklist items only for checklist notes', () => {
    const { result } = renderHook(() => useNoteForm());

    act(() => result.current.setType('CHECKLIST'));
    act(() => result.current.addChecklistItem());
    const key = result.current.form.checklistItems[0]!.key;
    act(() => result.current.updateChecklistItem(key, '牛乳'));
    expect(result.current.isEmpty()).toBe(false);

    // TEXT に戻すとチェックリストは画面に出ないため、本文が空なら「空」と判定する。
    // ここが false のままだと、本文を消してもメモが空にできない。
    act(() => result.current.setType('TEXT'));
    act(() => result.current.setContent(''));
    expect(result.current.isEmpty()).toBe(true);
  });
});
