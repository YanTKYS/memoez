import type { Note, NoteType } from '@/domain/entities/Note';
import { NOTE_COLOR_DARK, NOTE_COLOR_LIGHT } from '@/ui/theme/colors';
import { formatDueDateTime } from '@/lib/dateUtils';

/**
 * ウィジェットに描画するメモの内容。
 * ネイティブ側（modules/memoez-widget の NoteSnapshot.kt）と同じ形。
 * メモ本体の正は SQLite で、これは表示用のコピー（再生成可能）。
 */
export interface WidgetNoteSnapshot {
  noteId:       number;
  status:       'ok' | 'deleted';
  title:        string;
  type:         NoteType;
  /** テキストメモの本文（長すぎる分は切り詰める） */
  body:         string;
  /** チェックリストの項目（多すぎる分は切り詰める） */
  items:        { text: string; checked: boolean }[];
  itemCount:    number;
  checkedCount: number;
  dueText:      string | null;
  colorLight:   string;
  colorDark:    string;
  textLight:    string;
  textDark:     string;
}

/** ウィジェットに収まる量で十分なので、保存・受け渡しの量を抑える */
export const WIDGET_BODY_MAX_CHARS = 2000;
export const WIDGET_ITEMS_MAX      = 50;

/** メモ背景の上に置く文字色（React Native Paper の onSurface と同じ） */
const TEXT_LIGHT = '#1C1B1F';
const TEXT_DARK  = '#E6E1E5';

export function buildWidgetSnapshot(noteId: number, note: Note | null): WidgetNoteSnapshot {
  const color = note?.color ?? 'NONE';
  const base = {
    noteId,
    colorLight: NOTE_COLOR_LIGHT[color],
    colorDark:  NOTE_COLOR_DARK[color],
    textLight:  TEXT_LIGHT,
    textDark:   TEXT_DARK,
  };

  if (!note) {
    return {
      ...base,
      status: 'deleted',
      title: '',
      type: 'TEXT',
      body: '',
      items: [],
      itemCount: 0,
      checkedCount: 0,
      dueText: null,
    };
  }

  const isChecklist = note.type === 'CHECKLIST';
  const items = isChecklist
    ? note.checklistItems
        .filter((item) => item.text.trim())
        .map((item) => ({ text: item.text.replace(/\s*\n\s*/g, ' '), checked: item.isChecked }))
    : [];

  return {
    ...base,
    status: 'ok',
    title: note.title.trim(),
    type: note.type,
    body: isChecklist ? '' : note.content.slice(0, WIDGET_BODY_MAX_CHARS),
    items: items.slice(0, WIDGET_ITEMS_MAX),
    itemCount: items.length,
    checkedCount: items.filter((item) => item.checked).length,
    dueText: note.dueAt ? formatDueDateTime(note.dueAt) : null,
  };
}
