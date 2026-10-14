import type { Note } from '@/domain/entities/Note';
import {
  buildWidgetListSnapshot,
  WIDGET_LIST_LIMIT,
  widgetListText,
} from '@/lib/widget/widgetListSnapshot';
import { NOTE_COLOR_DARK, NOTE_COLOR_LIGHT } from '@/ui/theme/colors';

let seq = 0;
function note(overrides: Partial<Note> = {}): Note {
  seq += 1;
  return {
    id: seq,
    title: `メモ${seq}`,
    content: '',
    type: 'TEXT',
    color: 'NONE',
    isPinned: false,
    isArchived: false,
    dueAt: null,
    reminderAt: null,
    sortWeight: 0,
    createdAt: new Date(2026, 0, 1),
    updatedAt: new Date(2026, 0, 1),
    deletedAt: null,
    labels: [],
    checklistItems: [],
    ...overrides,
  };
}

function item(id: number, text: string, isChecked: boolean) {
  return { id, noteId: 1, text, isChecked, position: id, createdAt: new Date(), deletedAt: null };
}

describe('buildWidgetListSnapshot', () => {
  it('orders pinned notes first, then by last update (newest first)', () => {
    const older  = note({ updatedAt: new Date(2026, 0, 1) });
    const newer  = note({ updatedAt: new Date(2026, 0, 5) });
    const pinned = note({ updatedAt: new Date(2025, 0, 1), isPinned: true });

    const snap = buildWidgetListSnapshot([older, newer, pinned]);
    expect(snap.items.map((i) => i.noteId)).toEqual([pinned.id, newer.id, older.id]);
  });

  it('never shows archived or deleted notes', () => {
    const visible  = note();
    const archived = note({ isArchived: true });
    const deleted  = note({ deletedAt: new Date() });

    const snap = buildWidgetListSnapshot([visible, archived, deleted]);
    expect(snap.items.map((i) => i.noteId)).toEqual([visible.id]);
  });

  it(`shows at most ${WIDGET_LIST_LIMIT} notes`, () => {
    const many = Array.from({ length: WIDGET_LIST_LIMIT + 10 }, (_, i) => note({ updatedAt: new Date(2026, 0, 1, 0, i) }));
    const snap = buildWidgetListSnapshot(many);
    expect(snap.items.length).toBe(WIDGET_LIST_LIMIT);
    // 新しいものから残る
    expect(snap.items[0]!.noteId).toBe(many[many.length - 1]!.id);
  });

  it('reflects the note color only as an accent, and not at all for the default color', () => {
    const snap = buildWidgetListSnapshot([note({ color: 'BLUE' }), note({ color: 'NONE', updatedAt: new Date(2025, 0, 1) })]);
    expect(snap.items[0]).toMatchObject({ accentLight: NOTE_COLOR_LIGHT.BLUE, accentDark: NOTE_COLOR_DARK.BLUE });
    expect(snap.items[1]).toMatchObject({ accentLight: null, accentDark: null });
  });

  it('is plain JSON so it can cross the native bridge as-is', () => {
    const snap = buildWidgetListSnapshot([note({ content: '本文' })]);
    expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);
  });
});

describe('widgetListText', () => {
  it('shows the title and the beginning of the body on one line', () => {
    expect(widgetListText(note({ title: '会議', content: '議題\n・予算\n・日程' })))
      .toEqual({ title: '会議', preview: '議題 ・予算 ・日程' });
  });

  it('uses the first body line as the title when the note has no title', () => {
    expect(widgetListText(note({ title: '  ', content: '\n牛乳を買う\nパンも\n' })))
      .toEqual({ title: '牛乳を買う', preview: 'パンも' });
  });

  it('summarizes a checklist as progress plus the remaining items', () => {
    const list = note({
      title: '買い物',
      type: 'CHECKLIST',
      content: '古い本文',
      checklistItems: [item(1, '牛乳', true), item(2, '  ', false), item(3, 'パン', false), item(4, 'たまご', false)],
    });
    expect(widgetListText(list)).toEqual({ title: '買い物', preview: '1/3 完了・パン、たまご' });

    const done = note({ type: 'CHECKLIST', title: '', checklistItems: [item(1, '掃除', true)] });
    expect(widgetListText(done)).toEqual({ title: '掃除', preview: '1/1 完了' });
  });

  it('labels an empty note and truncates long text', () => {
    expect(widgetListText(note({ title: '', content: '' }))).toEqual({ title: '（空のメモ）', preview: '' });

    const long = widgetListText(note({ title: 'あ'.repeat(200), content: 'い'.repeat(500) }));
    expect(long.title.length).toBe(80);
    expect(long.preview.length).toBe(120);
    expect(long.preview.endsWith('…')).toBe(true);
  });
});
