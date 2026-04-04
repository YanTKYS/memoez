import { useState, useCallback, useRef } from 'react';
import type { Note, NoteType, NoteColor } from '@/domain/entities/Note';
import type { ChecklistItem } from '@/domain/entities/ChecklistItem';
import { isNoteEmpty } from '@/domain/entities/Note';

export interface DraftChecklistItem {
  /** 既存アイテムのid (新規はundefined) */
  key:       string;
  text:      string;
  isChecked: boolean;
}

export interface NoteFormState {
  title:         string;
  content:       string;
  type:          NoteType;
  color:         NoteColor;
  checklistItems: DraftChecklistItem[];
}

export interface UseNoteFormReturn {
  form:             NoteFormState;
  setTitle:         (v: string) => void;
  setContent:       (v: string) => void;
  setType:          (v: NoteType) => void;
  setColor:         (v: NoteColor) => void;
  addChecklistItem: () => void;
  updateChecklistItem: (key: string, text: string) => void;
  toggleChecklistItem: (key: string) => void;
  removeChecklistItem: (key: string) => void;
  isEmpty:          () => boolean;
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

let _keyCounter = 0;
function genKey() { return `new-${++_keyCounter}`; }

export function useNoteForm(initialNote?: Note): UseNoteFormReturn {
  const [form, setForm] = useState<NoteFormState>(
    initialNote ? noteToForm(initialNote) : defaultForm(),
  );

  const setTitle   = useCallback((v: string) => setForm((f) => ({ ...f, title: v })),   []);
  const setContent = useCallback((v: string) => setForm((f) => ({ ...f, content: v })), []);
  const setType    = useCallback((v: NoteType) => {
    setForm((f) => ({
      ...f,
      type:           v,
      // TEXT→CHECKLISTに切り替え時、本文の行をアイテムに変換
      checklistItems: v === 'CHECKLIST' && f.checklistItems.length === 0 && f.content.trim()
        ? f.content
            .split('\n')
            .filter((l) => l.trim())
            .map((l) => ({ key: genKey(), text: l.trim(), isChecked: false }))
        : f.checklistItems,
      content: v === 'CHECKLIST' ? '' : f.content,
    }));
  }, []);
  const setColor = useCallback((v: NoteColor) => setForm((f) => ({ ...f, color: v })), []);

  const addChecklistItem = useCallback(() => {
    setForm((f) => ({
      ...f,
      checklistItems: [
        ...f.checklistItems,
        { key: genKey(), text: '', isChecked: false },
      ],
    }));
  }, []);

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

  const isEmpty = useCallback(() =>
    isNoteEmpty({
      title:          form.title,
      content:        form.content,
      checklistItems: form.checklistItems.filter((i) => i.text.trim()) as any,
    }),
  [form]);

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
    isEmpty,
  };
}
