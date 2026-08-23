import { buildCalendarCells, roundToMinuteStep } from '@/ui/components/EditNote/DueDatePickerModal';

describe('roundToMinuteStep', () => {
  it('rounds minutes to the nearest 5 and clears seconds', () => {
    const rounded = roundToMinuteStep(new Date(2026, 3, 19, 14, 37, 42, 500));
    expect(rounded.getMinutes()).toBe(35);
    expect(rounded.getSeconds()).toBe(0);
    expect(rounded.getMilliseconds()).toBe(0);
  });

  it('rounds up when closer to the next step', () => {
    expect(roundToMinuteStep(new Date(2026, 3, 19, 14, 38)).getMinutes()).toBe(40);
  });

  it('carries over into the next hour', () => {
    const rounded = roundToMinuteStep(new Date(2026, 3, 19, 14, 58));
    expect(rounded.getHours()).toBe(15);
    expect(rounded.getMinutes()).toBe(0);
  });

  it('keeps a value that is already on a step', () => {
    const rounded = roundToMinuteStep(new Date(2026, 3, 19, 9, 15));
    expect(rounded.getHours()).toBe(9);
    expect(rounded.getMinutes()).toBe(15);
  });
});

describe('buildCalendarCells', () => {
  it('starts on the Sunday of the first week and fills 42 days', () => {
    const cells = buildCalendarCells(new Date(2026, 3, 1)); // 2026年4月

    expect(cells.length).toBe(42);
    expect(cells[0]?.getDay()).toBe(0);
    // 2026-04-01 は水曜なので、先頭は 3/29
    expect(cells[0]?.getMonth()).toBe(2);
    expect(cells[0]?.getDate()).toBe(29);
    expect(cells[41]?.getMonth()).toBe(4);
    expect(cells[41]?.getDate()).toBe(9);
  });

  it('advances exactly one day per cell across month ends', () => {
    const cells = buildCalendarCells(new Date(2026, 0, 1)); // 2026年1月
    for (let i = 1; i < cells.length; i += 1) {
      const diff = cells[i]!.getTime() - cells[i - 1]!.getTime();
      expect(diff).toBe(24 * 60 * 60 * 1000);
    }
  });
});
