import type { Note } from '@/domain/entities/Note';

export type SearchMode = 'none' | 'keyword' | 'label' | 'label+keyword';

export type SearchPlan = {
  mode: SearchMode;
  keyword: string;
  selectedLabelId: number | null;
};

export function normalizeKeyword(query: string): string {
  return query.trim();
}

export function buildSearchPlan(query: string, selectedLabelId: number | null): SearchPlan {
  const keyword = normalizeKeyword(query);

  if (!keyword && selectedLabelId === null) {
    return { mode: 'none', keyword, selectedLabelId };
  }

  if (keyword && selectedLabelId !== null) {
    return { mode: 'label+keyword', keyword, selectedLabelId };
  }

  if (selectedLabelId !== null) {
    return { mode: 'label', keyword, selectedLabelId };
  }

  return { mode: 'keyword', keyword, selectedLabelId };
}

export function noteMatchesKeyword(note: Note, keyword: string): boolean {
  const lower = keyword.toLowerCase();
  if (note.title.toLowerCase().includes(lower)) return true;
  if (note.content.toLowerCase().includes(lower)) return true;
  if (note.labels.some((label) => label.name.toLowerCase().includes(lower))) return true;
  return note.checklistItems.some((item) => item.text.toLowerCase().includes(lower));
}
