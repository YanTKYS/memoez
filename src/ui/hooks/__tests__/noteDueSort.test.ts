import type { Note } from '@/domain/entities/Note';
import { sortNotesByDueThenUpdated } from '@/ui/hooks/noteDueSort';

function makeNote(id: number, overrides: Partial<Note> = {}): Note {
  return {
    id,
    title: `note-${id}`,
    content: '',
    type: 'TEXT',
    color: 'NONE',
    isPinned: false,
    isArchived: false,
    dueAt: null,
    reminderAt: null,
    sortWeight: 0,
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
    updatedAt: new Date('2026-04-01T00:00:00.000Z'),
    deletedAt: null,
    labels: [],
    checklistItems: [],
    ...overrides,
  };
}

describe('sortNotesByDueThenUpdated', () => {
  it('sorts by dueAt ascending and keeps null dueAt at the end', () => {
    const notes = [
      makeNote(1, { dueAt: null }),
      makeNote(2, { dueAt: new Date('2026-04-20T10:00:00.000Z') }),
      makeNote(3, { dueAt: new Date('2026-04-19T10:00:00.000Z') }),
    ];

    const result = sortNotesByDueThenUpdated(notes);
    expect(result.map((n) => n.id).join(',')).toBe('3,2,1');
  });

  it('uses updatedAt desc when dueAt is same', () => {
    const notes = [
      makeNote(1, {
        dueAt: new Date('2026-04-19T10:00:00.000Z'),
        updatedAt: new Date('2026-04-19T08:00:00.000Z'),
      }),
      makeNote(2, {
        dueAt: new Date('2026-04-19T10:00:00.000Z'),
        updatedAt: new Date('2026-04-19T12:00:00.000Z'),
      }),
    ];

    const result = sortNotesByDueThenUpdated(notes);
    expect(result.map((n) => n.id).join(',')).toBe('2,1');
  });
});
