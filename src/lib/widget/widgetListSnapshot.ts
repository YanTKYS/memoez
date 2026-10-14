import type { Note } from '@/domain/entities/Note';
import { NOTE_COLOR_DARK, NOTE_COLOR_LIGHT } from '@/ui/theme/colors';

/**
 * 4×2 一覧ウィジェットに描画する内容。
 * ネイティブ側（modules/memoez-widget の NoteListSnapshot.kt）と同じ形。
 * メモ本体の正は SQLite で、これは表示用のコピー（再生成可能）。
 */
export interface WidgetListItem {
  noteId:  number;
  /** 行の 1 行目（太字）。タイトルが空なら本文の 1 行目 */
  title:   string;
  /** 行の 2 行目（補助情報）。本文の冒頭、またはチェックリストの進捗と未完了項目 */
  preview: string;
  /** メモのカラー（行の左端の帯）。カラー「デフォルト」は帯を出さない */
  accentLight: string | null;
  accentDark:  string | null;
}

export interface WidgetListSnapshot {
  items:           WidgetListItem[];
  backgroundLight: string;
  backgroundDark:  string;
  textLight:       string;
  textDark:        string;
}

/** 端末負荷を考慮した表示件数の上限 */
export const WIDGET_LIST_LIMIT = 50;
const TITLE_MAX_CHARS   = 80;
const PREVIEW_MAX_CHARS = 120;

/** React Native Paper（MD3）の surface / onSurface と同じ配色 */
const BACKGROUND_LIGHT = '#FFFBFE';
const BACKGROUND_DARK  = '#1C1B1F';
const TEXT_LIGHT = '#1C1B1F';
const TEXT_DARK  = '#E6E1E5';

/** 一覧の並び順: ピン留め優先 → 更新日時の新しい順（同時刻は新しく作ったメモを先に） */
export function compareForWidgetList(a: Note, b: Note): number {
  return Number(b.isPinned) - Number(a.isPinned)
    || b.updatedAt.getTime() - a.updatedAt.getTime()
    || b.id - a.id;
}

const oneLine  = (text: string) => text.replace(/\s+/g, ' ').trim();
const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** 行に出すタイトルと本文冒頭 */
export function widgetListText(note: Note): { title: string; preview: string } {
  let title = oneLine(note.title);
  let preview: string;

  if (note.type === 'CHECKLIST') {
    const items     = note.checklistItems.filter((item) => item.text.trim());
    const remaining = items.filter((item) => !item.isChecked).map((item) => oneLine(item.text));
    const checked   = items.length - remaining.length;
    preview = items.length === 0
      ? ''
      : `${checked}/${items.length} 完了${remaining.length > 0 ? `・${remaining.join('、')}` : ''}`;
    if (!title && items[0]) title = oneLine(items[0].text);
  } else {
    const lines = note.content.split('\n').map((line) => line.trim()).filter(Boolean);
    if (title) {
      preview = oneLine(note.content);
    } else {
      title   = lines[0] ?? '';
      preview = oneLine(lines.slice(1).join(' '));
    }
  }

  if (!title && !preview) title = '（空のメモ）';
  return { title: truncate(title, TITLE_MAX_CHARS), preview: truncate(preview, PREVIEW_MAX_CHARS) };
}

/**
 * 一覧ウィジェットの表示内容を作る。並び順・件数・除外条件は Repository の findRecent と同じだが、
 * 表示の約束としてここでも保証する。
 */
export function buildWidgetListSnapshot(notes: Note[]): WidgetListSnapshot {
  const items = notes
    .filter((note) => note.deletedAt === null && !note.isArchived)
    .sort(compareForWidgetList)
    .slice(0, WIDGET_LIST_LIMIT)
    .map((note): WidgetListItem => ({
      noteId: note.id,
      ...widgetListText(note),
      accentLight: note.color === 'NONE' ? null : NOTE_COLOR_LIGHT[note.color],
      accentDark:  note.color === 'NONE' ? null : NOTE_COLOR_DARK[note.color],
    }));

  return {
    items,
    backgroundLight: BACKGROUND_LIGHT,
    backgroundDark:  BACKGROUND_DARK,
    textLight:       TEXT_LIGHT,
    textDark:        TEXT_DARK,
  };
}
