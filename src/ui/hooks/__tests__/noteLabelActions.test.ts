import type { Label } from '@/domain/entities/Label';
import { computeNextLabels } from '@/ui/hooks/useNoteLabelActions';

function label(id: number, name: string): Label {
  return {
    id,
    name,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
}

describe('useNoteLabelActions helpers', () => {
  it('removes label when currently attached', () => {
    const a = label(1, 'A');
    const b = label(2, 'B');
    const next = computeNextLabels([a, b], a, true);
    expect(next.length).toBe(1);
    expect(next[0]?.id).toBe(2);
  });

  it('adds label when currently detached', () => {
    const a = label(1, 'A');
    const b = label(2, 'B');
    const next = computeNextLabels([a], b, false);
    expect(next.length).toBe(2);
    expect(next[1]?.id).toBe(2);
  });

  it('does not mutate original array', () => {
    const a = label(1, 'A');
    const current = [a];
    const next = computeNextLabels(current, label(2, 'B'), false);
    expect(current.length).toBe(1);
    expect(next.length).toBe(2);
  });
});
