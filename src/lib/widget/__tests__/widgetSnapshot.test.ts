import type { Note } from '@/domain/entities/Note';
import {
  buildWidgetSnapshot,
  WIDGET_BODY_MAX_CHARS,
  WIDGET_ITEMS_MAX,
} from '@/lib/widget/widgetSnapshot';
import { NOTE_COLOR_DARK, NOTE_COLOR_LIGHT } from '@/ui/theme/colors';

function note(overrides: Partial<Note> = {}): Note {
  const now = new Date(2026, 9, 1, 9, 0);
  return {
    id: 7,
    title: '買い物',
    content: '',
    type: 'TEXT',
    color: 'YELLOW',
    isPinned: false,
    isArchived: false,
    dueAt: null,
    reminderAt: null,
    sortWeight: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    labels: [],
    checklistItems: [],
    ...overrides,
  };
}

function item(id: number, text: string, isChecked: boolean) {
  return { id, noteId: 7, text, isChecked, position: id * 1000, createdAt: new Date(), deletedAt: null };
}

describe('buildWidgetSnapshot', () => {
  it('uses the same light / dark colors as the app', () => {
    const snap = buildWidgetSnapshot(7, note({ color: 'GREEN' }));
    expect(snap.colorLight).toBe(NOTE_COLOR_LIGHT.GREEN);
    expect(snap.colorDark).toBe(NOTE_COLOR_DARK.GREEN);
  });

  it('shows the body of a text note', () => {
    const snap = buildWidgetSnapshot(7, note({ content: '牛乳を買う\nパンも' }));
    expect(snap).toMatchObject({
      noteId: 7, status: 'ok', title: '買い物', type: 'TEXT', body: '牛乳を買う\nパンも', items: [],
    });
  });

  it('shows checklist items with their checked state and progress, skipping blank items', () => {
    const snap = buildWidgetSnapshot(7, note({
      type: 'CHECKLIST',
      content: '残っていた本文',
      checklistItems: [item(1, '牛乳', true), item(2, '  ', false), item(3, 'パン\nライ麦', false)],
    }));
    expect(snap.body).toBe('');
    expect(snap.items).toEqual([
      { text: '牛乳', checked: true },
      { text: 'パン ライ麦', checked: false },
    ]);
    expect(snap.itemCount).toBe(2);
    expect(snap.checkedCount).toBe(1);
  });

  it('limits the amount of text handed to the widget', () => {
    const many = Array.from({ length: WIDGET_ITEMS_MAX + 5 }, (_, i) => item(i + 1, `item ${i}`, false));
    const list = buildWidgetSnapshot(7, note({ type: 'CHECKLIST', checklistItems: many }));
    expect(list.items.length).toBe(WIDGET_ITEMS_MAX);
    expect(list.itemCount).toBe(WIDGET_ITEMS_MAX + 5);

    const text = buildWidgetSnapshot(7, note({ content: 'あ'.repeat(WIDGET_BODY_MAX_CHARS + 100) }));
    expect(text.body.length).toBe(WIDGET_BODY_MAX_CHARS);
  });

  it('formats the due date like the app', () => {
    const snap = buildWidgetSnapshot(7, note({ dueAt: new Date(2026, 9, 20, 18, 5) }));
    expect(snap.dueText).toBe('2026/10/20 18:05');
  });

  it('marks a missing (deleted) note so the widget can offer to pick another one', () => {
    const snap = buildWidgetSnapshot(12, null);
    expect(snap).toMatchObject({ noteId: 12, status: 'deleted', title: '', items: [], dueText: null });
    expect(snap.colorLight).toBe(NOTE_COLOR_LIGHT.NONE);
  });

  it('is plain JSON so it can cross the native bridge as-is', () => {
    const snap = buildWidgetSnapshot(7, note({ dueAt: new Date(2026, 0, 1) }));
    expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);
  });
});
