import type { Note } from '@/domain/entities/Note';

function dueTime(note: Note): number {
  return note.dueAt ? note.dueAt.getTime() : Number.POSITIVE_INFINITY;
}

/**
 * 期限が近い順（null は最後）→ 更新日時が新しい順でソート。
 * ピン留めセクション内/通常セクション内の並び替えに使う。
 */
export function sortNotesByDueThenUpdated(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    const byDue = dueTime(a) - dueTime(b);
    if (byDue !== 0) return byDue;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });
}

