import type { Note, NoteColor, NoteType } from '@/domain/entities/Note';
import type { ChecklistItem } from '@/domain/entities/ChecklistItem';
import type { Label } from '@/domain/entities/Label';
import type { InferSelectModel } from 'drizzle-orm';
import type { notes, checklistItems, labels } from '../db/schema';

type NoteRow          = InferSelectModel<typeof notes>;
type ChecklistItemRow = InferSelectModel<typeof checklistItems>;
type LabelRow         = InferSelectModel<typeof labels>;

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
    dueAt:          row.dueAt
                      ? (row.dueAt instanceof Date ? row.dueAt : new Date(row.dueAt))
                      : null,
    reminderAt:     row.reminderAt
                      ? (row.reminderAt instanceof Date ? row.reminderAt : new Date(row.reminderAt))
                      : null,
    sortWeight:     row.sortWeight,
    createdAt:      row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
    updatedAt:      row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt),
    deletedAt:      row.deletedAt
                      ? (row.deletedAt instanceof Date ? row.deletedAt : new Date(row.deletedAt))
                      : null,
    labels:         labelRows.map(toLabel),
    checklistItems: itemRows.map(toChecklistItem),
  };
}

export function toLabel(row: LabelRow): Label {
  return {
    id:        row.id,
    name:      row.name,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt),
    deletedAt: row.deletedAt
                 ? (row.deletedAt instanceof Date ? row.deletedAt : new Date(row.deletedAt))
                 : null,
  };
}

export function toChecklistItem(row: ChecklistItemRow): ChecklistItem {
  return {
    id:        row.id,
    noteId:    row.noteId,
    text:      row.text,
    isChecked: Boolean(row.isChecked),
    position:  row.position,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
    deletedAt: row.deletedAt
                 ? (row.deletedAt instanceof Date ? row.deletedAt : new Date(row.deletedAt))
                 : null,
  };
}
