import { useState, useCallback, useRef } from 'react';
import type { Note, NoteType, NoteColor } from '@/domain/entities/Note';
import { isNoteEmpty } from '@/domain/entities/Note';

export interface DraftChecklistItem {
  key:       string;
  text:      string;
  isChecked: boolean;
}

export function textToChecklistParagraphs(text: string): DraftChecklistItem[] {
  return text
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, idx) => ({
      key: `parsed-${idx}`,
      text: block.replace(/\n+/g, ' ').trim(),
      isChecked: false,
    }));
}

export function checklistToBulletText(items: DraftChecklistItem[]): string {
  return items
    .map((item) => item.text.trim())
    .filter(Boolean)
    .map((text) => `• ${text}`)
    .join('\n');
}

export interface NoteFormState {
  title:          string;
  content:        string;
  type:           NoteType;
  color:          NoteColor;
  dueAt:          Date | null;
  reminderAt:     Date | null;
  checklistItems: DraftChecklistItem[];
}

export interface UseNoteFormReturn {
  form:                NoteFormState;
  setTitle:            (v: string) => void;
  setContent:          (v: string) => void;
  setType:             (v: NoteType) => void;
  setColor:            (v: NoteColor) => void;
  setDueAt:            (v: Date | null) => void;
  addChecklistItem:    () => void;
  updateChecklistItem: (key: string, text: string) => void;
  toggleChecklistItem: (key: string) => void;
  removeChecklistItem: (key: string) => void;
  /** ロード済みノートでフォームを上書き初期化する */
  resetForm:           (note: Note) => void;
  isEmpty:             () => boolean;
  /** 直前に追加されたチェックリストアイテムのキー（autoFocus 用） */
  lastAddedKey:        string | null;
}

function noteToForm(note: Note): NoteFormState {
  return {
    title:   note.title,
    content: note.content,
    type:    note.type,
    color:   note.color,
    dueAt:   note.dueAt,
    reminderAt: note.reminderAt,
    checklistItems: note.checklistItems.map((item) => ({
      key:       String(item.id),
      text:      item.text,
      isChecked: item.isChecked,
    })),
  };
}

const defaultForm = (): NoteFormState => ({
  title:          '',
  content:        '',
  type:           'TEXT',
  color:          'NONE',
  dueAt:          null,
  reminderAt:     null,
  checklistItems: [],
});

export function useNoteForm(): UseNoteFormReturn {
  const keyCounterRef = useRef(0);
  const genKey = useCallback(() => `new-${++keyCounterRef.current}`, []);
  const [lastAddedKey, setLastAddedKey] = useState<string | null>(null);

  // 初期値は常に空。既存ノートは resetForm() で上書きする。
  const [form, setForm] = useState<NoteFormState>(defaultForm());

  const resetForm = useCallback((note: Note) => {
    setForm(noteToForm(note));
  }, []);

  const setTitle   = useCallback((v: string) => setForm((f) => ({ ...f, title: v })),   []);
  const setContent = useCallback((v: string) => setForm((f) => ({ ...f, content: v })), []);

  const setType = useCallback((v: NoteType) => {
    setForm((f) => ({
      ...f,
      type: v,
      checklistItems:
        v === 'CHECKLIST'
          ? (
              f.checklistItems.length > 0
                ? f.checklistItems
                : textToChecklistParagraphs(f.content).map((item) => ({ ...item, key: genKey() })
                )
            )
          : f.checklistItems,
      content:
        v === 'CHECKLIST'
          ? ''
          : (
              f.content.trim()
                ? f.content
                : checklistToBulletText(f.checklistItems)
            ),
    }));
  }, [genKey]);

  const setColor = useCallback((v: NoteColor) => setForm((f) => ({ ...f, color: v })), []);
  const setDueAt = useCallback((v: Date | null) => setForm((f) => ({ ...f, dueAt: v })), []);

  const addChecklistItem = useCallback(() => {
    const key = genKey();
    setLastAddedKey(key);
    setForm((f) => ({
      ...f,
      checklistItems: [
        ...f.checklistItems,
        { key, text: '', isChecked: false },
      ],
    }));
  }, [genKey]);

  const updateChecklistItem = useCallback((key: string, text: string) => {
    setForm((f) => ({
      ...f,
      checklistItems: f.checklistItems.map((item) =>
        item.key === key ? { ...item, text } : item,
      ),
    }));
  }, []);

  const toggleChecklistItem = useCallback((key: string) => {
    setForm((f) => ({
      ...f,
      checklistItems: f.checklistItems.map((item) =>
        item.key === key ? { ...item, isChecked: !item.isChecked } : item,
      ),
    }));
  }, []);

  const removeChecklistItem = useCallback((key: string) => {
    setForm((f) => ({
      ...f,
      checklistItems: f.checklistItems.filter((item) => item.key !== key),
    }));
  }, []);

  const isEmpty = useCallback(
    () =>
      isNoteEmpty({
        title:          form.title,
        content:        form.content,
        checklistItems: form.checklistItems.filter((i) => i.text.trim()),
      }),
    [form],
  );

  return {
    form,
    setTitle,
    setContent,
    setType,
    setColor,
    setDueAt,
    addChecklistItem,
    updateChecklistItem,
    toggleChecklistItem,
    removeChecklistItem,
    resetForm,
    isEmpty,
    lastAddedKey,
  };
}
