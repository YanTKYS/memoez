import { useState, useCallback, useRef } from 'react';
import type { Note, NoteType, NoteColor } from '@/domain/entities/Note';
import { isNoteEmpty } from '@/domain/entities/Note';

export interface DraftChecklistItem {
  key:       string;
  text:      string;
  isChecked: boolean;
}

export interface NoteFormState {
  title:          string;
  content:        string;
  type:           NoteType;
  color:          NoteColor;
  checklistItems: DraftChecklistItem[];
}

export interface UseNoteFormReturn {
  form:                NoteFormState;
  setTitle:            (v: string) => void;
  setContent:          (v: string) => void;
  setType:             (v: NoteType) => void;
  setColor:            (v: NoteColor) => void;
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
        v === 'CHECKLIST' && f.checklistItems.length === 0 && f.content.trim()
          ? f.content
              .split('\n')
              .filter((l) => l.trim())
              .map((l) => ({ key: genKey(), text: l.trim(), isChecked: false }))
          : f.checklistItems,
      content: v === 'CHECKLIST' ? '' : f.content,
    }));
  }, [genKey]);

  const setColor = useCallback((v: NoteColor) => setForm((f) => ({ ...f, color: v })), []);

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
        // DraftChecklistItem は id 等を持たないが isNoteEmpty は length のみ参照
        checklistItems: form.checklistItems.filter((i) => i.text.trim()) as any,
      }),
    [form],
  );

  return {
    form,
    setTitle,
    setContent,
    setType,
    setColor,
    addChecklistItem,
    updateChecklistItem,
    toggleChecklistItem,
    removeChecklistItem,
    resetForm,
    isEmpty,
    lastAddedKey,
  };
}
