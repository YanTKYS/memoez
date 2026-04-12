import { isNoteEmpty } from '@/domain/entities/Note';
import { nextSortWeight, midSortWeight } from '@/lib/sortWeight';

describe('isNoteEmpty', () => {
  it('returns true for blank title/content and empty checklist', () => {
    expect(
      isNoteEmpty({
        title: '   ',
        content: '\n',
        checklistItems: [],
      }),
    ).toBe(true);
  });

  it('returns false when checklist has at least one item', () => {
    expect(
      isNoteEmpty({
        title: '',
        content: '',
        checklistItems: [{}],
      }),
    ).toBe(false);
  });
});

describe('sortWeight helpers', () => {
  it('nextSortWeight increments by 1000', () => {
    expect(nextSortWeight(3000)).toBe(4000);
  });

  it('midSortWeight returns middle value', () => {
    expect(midSortWeight(1000, 3000)).toBe(2000);
  });
});
