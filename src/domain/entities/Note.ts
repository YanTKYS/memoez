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
// checklistItems は length のみ参照するため ChecklistItem 以外（DraftChecklistItem 等）も受け入れる
export function isNoteEmpty(
  note: Pick<Note, 'title' | 'content'> & { checklistItems: { length: number } },
): boolean {
  return (
    note.title.trim() === '' &&
    note.content.trim() === '' &&
    note.checklistItems.length === 0
  );
}
