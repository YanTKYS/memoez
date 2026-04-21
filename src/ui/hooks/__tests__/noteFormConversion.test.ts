import { checklistToBulletText, textToChecklistParagraphs } from '@/ui/hooks/useNoteForm';

describe('noteForm conversion helpers', () => {
  it('converts text paragraphs into checklist items', () => {
    const parsed = textToChecklistParagraphs('段落A\n\n段落B\n2行目');
    expect(parsed.length).toBe(2);
    expect(parsed[0]?.text).toBe('段落A');
    expect(parsed[1]?.text).toBe('段落B 2行目');
  });

  it('converts checklist items into bullet text', () => {
    const text = checklistToBulletText([
      { key: '1', text: 'タスクA', isChecked: false },
      { key: '2', text: 'タスクB', isChecked: true },
    ]);
    expect(text).toBe('• タスクA\n• タスクB');
  });
});
