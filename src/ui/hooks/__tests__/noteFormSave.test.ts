import { checklistItemsToSave, type NoteFormState } from '@/ui/hooks/useNoteForm';

const form = (overrides: Partial<NoteFormState> = {}): NoteFormState => ({
  title:          '',
  content:        '',
  type:           'CHECKLIST',
  color:          'NONE',
  dueAt:          null,
  reminderAt:     null,
  checklistItems: [],
  ...overrides,
});

describe('checklistItemsToSave', () => {
  it('drops blank items and renumbers the remaining positions', () => {
    const items = checklistItemsToSave(form({
      checklistItems: [
        { key: 'a', text: '牛乳',  isChecked: false },
        { key: 'b', text: '   ',   isChecked: false },
        { key: 'c', text: 'パン',  isChecked: true },
      ],
    }));

    expect(items).toEqual([
      { text: '牛乳', isChecked: false, position: 0 },
      { text: 'パン', isChecked: true,  position: 1000 },
    ]);
  });

  it('saves nothing for a TEXT note, so leftover items get cleared', () => {
    const items = checklistItemsToSave(form({
      type: 'TEXT',
      checklistItems: [{ key: 'a', text: '牛乳', isChecked: false }],
    }));

    expect(items).toEqual([]);
  });
});
