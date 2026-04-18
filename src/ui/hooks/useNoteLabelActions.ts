import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { Label } from '@/domain/entities/Label';
import type { Note, NoteColor, NoteType } from '@/domain/entities/Note';
import { getLabelRepository, getNoteRepository } from '@/lib/di';

type TimerRef = MutableRefObject<ReturnType<typeof setTimeout> | null>;

type Params = {
  note: Note | null;
  setNote: Dispatch<SetStateAction<Note | null>>;
  mountedRef: MutableRefObject<boolean>;
  saveTimerRef: TimerRef;
  isEmpty: () => boolean;
  saveNote: () => Promise<void>;
  formType: NoteType;
  formColor: NoteColor;
};

export function computeNextLabels(current: Label[], target: Label, attached: boolean): Label[] {
  return attached
    ? current.filter((l) => l.id !== target.id)
    : [...current, target];
}

export function useNoteLabelActions({
  note,
  setNote,
  mountedRef,
  saveTimerRef,
  isEmpty,
  saveNote,
  formType,
  formColor,
}: Params) {
  const fetchLabels = useCallback((): Promise<Label[]> =>
    getLabelRepository().findAll(), []);

  const toggleNoteLabel = useCallback(async (label: Label, attached: boolean): Promise<void> => {
    if (!note) return;
    const prevLabels = note.labels;
    const newLabels = computeNextLabels(note.labels, label, attached);

    if (mountedRef.current) setNote({ ...note, labels: newLabels });

    const repo = getNoteRepository();
    try {
      if (attached) await repo.detachLabel(note.id, label.id);
      else await repo.attachLabel(note.id, label.id);
    } catch (e) {
      if (mountedRef.current) setNote({ ...note, labels: prevLabels });
      throw e;
    }
  }, [note, mountedRef, setNote]);

  const prepareForLabels = useCallback(async (): Promise<boolean> => {
    if (!note) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (!isEmpty()) {
        await saveNote();
      } else {
        try {
          const created = await getNoteRepository().create({
            title: '', content: '', type: formType, color: formColor,
          });
          if (mountedRef.current) setNote(created);
        } catch (e) {
          console.error('prepareForLabels create error:', e);
        }
      }
    }
    return mountedRef.current;
  }, [note, saveTimerRef, isEmpty, saveNote, formType, formColor, mountedRef, setNote]);

  return { fetchLabels, toggleNoteLabel, prepareForLabels };
}
