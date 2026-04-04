import type { Label } from './Label';
import type { ChecklistItem } from './ChecklistItem';

export type NoteType  = 'TEXT' | 'CHECKLIST';
export type NoteColor = 'NONE' | 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN' | 'TEAL' | 'BLUE' | 'PURPLE';

export interface Note {
  id:             number;
  title:          string;
  content:        string;
  type:           NoteType;
  color:          NoteColor;
  isPinned:       boolean;
  isArchived:     boolean;
  sortWeight:     number;
  createdAt:      Date;
  updatedAt:      Date;
  deletedAt:      Date | null;
  labels:         Label[];
  checklistItems: ChecklistItem[];
}

/** ビジネスルール: タイトル・本文・チェックリストが全て空か */
export function isNoteEmpty(
  note: Pick<Note, 'title' | 'content' | 'checklistItems'>,
): boolean {
  return (
    note.title.trim() === '' &&
    note.content.trim() === '' &&
    note.checklistItems.length === 0
  );
}
