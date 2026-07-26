import type { Note, NoteColor, NoteType } from '@/domain/entities/Note';
import type { ChecklistItem } from '@/domain/entities/ChecklistItem';
import type { Label } from '@/domain/entities/Label';
import type { InferSelectModel } from 'drizzle-orm';
import type { notes, checklistItems, labels } from '../db/schema';

type NoteRow          = InferSelectModel<typeof notes>;
type ChecklistItemRow = InferSelectModel<typeof checklistItems>;
type LabelRow         = InferSelectModel<typeof labels>;

/**
 * Drizzle の timestamp_ms カラムは Date を返すが、生 SQL 経由の行は数値のまま来る。
 * どちらでも Date に正規化する。
 */
function toDate(value: Date | number | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function toNullableDate(value: Date | number | string | null | undefined): Date | null {
  return value == null ? null : toDate(value);
}

export function toNote(
  row:    NoteRow,
  labelRows: LabelRow[]         = [],
  itemRows:  ChecklistItemRow[] = [],
): Note {
  return {
    id:             row.id,
    title:          row.title,
    content:        row.content,
    type:           row.type as NoteType,
    color:          row.color as NoteColor,
    isPinned:       Boolean(row.isPinned),
    isArchived:     Boolean(row.isArchived),
    dueAt:          toNullableDate(row.dueAt),
    reminderAt:     toNullableDate(row.reminderAt),
    sortWeight:     row.sortWeight,
    createdAt:      toDate(row.createdAt),
    updatedAt:      toDate(row.updatedAt),
    deletedAt:      toNullableDate(row.deletedAt),
    labels:         labelRows.map(toLabel),
    checklistItems: itemRows.map(toChecklistItem),
  };
}

export function toLabel(row: LabelRow): Label {
  return {
    id:        row.id,
    name:      row.name,
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
    deletedAt: toNullableDate(row.deletedAt),
  };
}

export function toChecklistItem(row: ChecklistItemRow): ChecklistItem {
  return {
    id:        row.id,
    noteId:    row.noteId,
    text:      row.text,
    isChecked: Boolean(row.isChecked),
    position:  row.position,
    createdAt: toDate(row.createdAt),
    deletedAt: toNullableDate(row.deletedAt),
  };
}
