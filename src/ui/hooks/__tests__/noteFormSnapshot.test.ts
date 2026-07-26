import type { Note } from '@/domain/entities/Note';
import { noteFormSnapshot, noteToForm, type NoteFormState } from '@/ui/hooks/useNoteForm';

const baseNote: Note = {
  id: 1,
  title: 'タイトル',
  content: '本文',
  type: 'TEXT',
  color: 'NONE',
  isPinned: false,
  isArchived: false,
  dueAt: null,
  reminderAt: null,
  sortWeight: 1000,
  createdAt: new Date('2026-04-19T00:00:00.000Z'),
  updatedAt: new Date('2026-04-19T00:00:00.000Z'),
  deletedAt: null,
  labels: [],
  checklistItems: [],
};

const formOf = (overrides: Partial<NoteFormState> = {}): NoteFormState => ({
  ...noteToForm(baseNote),
  ...overrides,
});

describe('noteFormSnapshot', () => {
  it('is stable for a form loaded from an unchanged note', () => {
    expect(noteFormSnapshot(noteToForm(baseNote))).toBe(noteFormSnapshot(formOf()));
  });

  it('changes when a persisted field changes', () => {
    const before = noteFormSnapshot(formOf());
    expect(noteFormSnapshot(formOf({ title: '別タイトル' }))).not.toBe(before);
    expect(noteFormSnapshot(formOf({ color: 'BLUE' }))).not.toBe(before);
    expect(noteFormSnapshot(formOf({ dueAt: new Date('2026-05-01T12:00:00.000Z') }))).not.toBe(before);
  });

  it('ignores blank checklist items, which are dropped on save', () => {
    expect(
      noteFormSnapshot(formOf({ checklistItems: [{ key: 'new-1', text: '  ', isChecked: false }] })),
    ).toBe(noteFormSnapshot(formOf()));
  });

  it('reflects checklist text and checked state', () => {
    const withItem = formOf({ checklistItems: [{ key: 'new-1', text: '牛乳', isChecked: false }] });
    const checked = formOf({ checklistItems: [{ key: 'new-1', text: '牛乳', isChecked: true }] });
    expect(noteFormSnapshot(withItem)).not.toBe(noteFormSnapshot(formOf()));
    expect(noteFormSnapshot(checked)).not.toBe(noteFormSnapshot(withItem));
  });
});
