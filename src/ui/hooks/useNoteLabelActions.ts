import { useCallback, type MutableRefObject } from 'react';
import type { Label } from '@/domain/entities/Label';
import type { Note, NoteColor, NoteType } from '@/domain/entities/Note';
import { getLabelRepository, getNoteRepository } from '@/lib/di';

type Params = {
  /** 最新のノートを返す（保存直後の生成分も取りこぼさないため関数で受け取る） */
  getNote: () => Note | null;
  setNote: (note: Note | null) => void;
  mountedRef: MutableRefObject<boolean>;
  isEmpty: () => boolean;
  saveNote: () => Promise<void>;
  formType: NoteType;
  formColor: NoteColor;
  /** ラベル付与のために空メモを自動生成したことを呼び出し元へ通知する */
  onPlaceholderCreated?: () => void;
};

export function computeNextLabels(current: Label[], target: Label, attached: boolean): Label[] {
  return attached
    ? current.filter((l) => l.id !== target.id)
    : [...current, target];
}

export function useNoteLabelActions({
  getNote,
  setNote,
  mountedRef,
  isEmpty,
  saveNote,
  formType,
  formColor,
  onPlaceholderCreated,
}: Params) {
  const fetchLabels = useCallback((): Promise<Label[]> =>
    getLabelRepository().findAll(), []);

  const toggleNoteLabel = useCallback(async (label: Label, attached: boolean): Promise<void> => {
    const note = getNote();
    if (!note) return;
    const prevLabels = note.labels;

    if (mountedRef.current) setNote({ ...note, labels: computeNextLabels(prevLabels, label, attached) });

    const repo = getNoteRepository();
    try {
      if (attached) await repo.detachLabel(note.id, label.id);
      else await repo.attachLabel(note.id, label.id);
    } catch (e) {
      if (mountedRef.current) setNote({ ...note, labels: prevLabels });
      throw e;
    }
  }, [getNote, mountedRef, setNote]);

  const prepareForLabels = useCallback(async (): Promise<boolean> => {
    // ラベルはメモに紐付けるものなので、まだ保存されていなければ先に実体を作る
    if (!getNote()) {
      if (!isEmpty()) {
        await saveNote();
      } else {
        try {
          const created = await getNoteRepository().create({
            title: '', content: '', type: formType, color: formColor,
          });
          onPlaceholderCreated?.();
          if (mountedRef.current) setNote(created);
        } catch (e) {
          console.error('prepareForLabels create error:', e);
        }
      }
    }
    return mountedRef.current;
  }, [getNote, isEmpty, saveNote, formType, formColor, mountedRef, setNote, onPlaceholderCreated]);

  return { fetchLabels, toggleNoteLabel, prepareForLabels };
}
