import type { Note } from '@/domain/entities/Note';
import { buildSearchPlan, normalizeKeyword, noteMatchesKeyword } from '@/ui/hooks/searchQueryPlan';

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 1,
    title: 'Default title',
    content: 'Default content',
    type: 'TEXT',
    color: 'NONE',
    isPinned: false,
    isArchived: false,
    dueAt: null,
    reminderAt: null,
    sortWeight: 1000,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    labels: [],
    checklistItems: [],
    ...overrides,
  };
}

describe('searchQueryPlan', () => {
  it('normalizeKeyword trims spaces', () => {
    expect(normalizeKeyword('  abc  ')).toBe('abc');
  });

  it('buildSearchPlan returns none when no query and no label', () => {
    expect(buildSearchPlan('   ', null).mode).toBe('none');
  });

  it('buildSearchPlan returns label mode when label only', () => {
    const plan = buildSearchPlan('   ', 12);
    expect(plan.mode).toBe('label');
    expect(plan.selectedLabelId).toBe(12);
  });

  it('buildSearchPlan returns keyword mode when query only', () => {
    const plan = buildSearchPlan('note', null);
    expect(plan.mode).toBe('keyword');
    expect(plan.keyword).toBe('note');
  });

  it('buildSearchPlan returns label+keyword mode when both set', () => {
    const plan = buildSearchPlan('note', 99);
    expect(plan.mode).toBe('label+keyword');
    expect(plan.keyword).toBe('note');
    expect(plan.selectedLabelId).toBe(99);
  });

  it('noteMatchesKeyword matches title/content/label/checklist', () => {
    const base = makeNote();
    expect(noteMatchesKeyword({ ...base, title: 'Refactor Plan' }, 'refactor')).toBe(true);
    expect(noteMatchesKeyword({ ...base, content: 'Search by label' }, 'label')).toBe(true);
    expect(noteMatchesKeyword({ ...base, labels: [{ id: 1, name: '改善', createdAt: new Date(), updatedAt: new Date(), deletedAt: null }] }, '改善')).toBe(true);
    expect(noteMatchesKeyword({ ...base, checklistItems: [{ id: 1, noteId: 1, text: 'Write tests', isChecked: false, position: 0, createdAt: new Date(), deletedAt: null }] }, 'tests')).toBe(true);
    expect(noteMatchesKeyword(base, 'not-found')).toBe(false);
  });
});
