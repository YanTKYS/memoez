import { buildDueDatePresets } from '@/ui/hooks/dueDatePresets';

describe('buildDueDatePresets', () => {
  it('returns fixed 4 presets with expected labels', () => {
    const now = new Date('2026-04-19T10:15:00.000Z');
    const presets = buildDueDatePresets(now);
    expect(presets.length).toBe(4);
    expect(presets[0]?.label).toBe('今日 21:00');
    expect(presets[1]?.label).toBe('明日 21:00');
    expect(presets[2]?.label).toBe('1週間後 21:00');
    expect(presets[3]?.label).toBe('期限を解除');
  });

  it('builds due dates at 21:00 and clear action as null', () => {
    const now = new Date('2026-04-19T01:00:00.000Z');
    const presets = buildDueDatePresets(now);
    expect(presets[0]?.value?.toISOString()).toBe('2026-04-19T21:00:00.000Z');
    expect(presets[1]?.value?.toISOString()).toBe('2026-04-20T21:00:00.000Z');
    expect(presets[2]?.value?.toISOString()).toBe('2026-04-26T21:00:00.000Z');
    expect(presets[3]?.value).toBe(null);
  });
});

