import { ReminderScheduler } from '@/lib/reminderScheduler';

describe('ReminderScheduler', () => {
  it('schedules future reminder and triggers callback', () => {
    let capturedDelay = -1;
    let capturedFn: (() => void) = () => {};
    const triggered: number[] = [];

    const scheduler = new ReminderScheduler({
      now: () => Date.parse('2026-04-19T00:00:00.000Z'),
      setTimeout: (cb, delay) => {
        capturedFn = cb;
        capturedDelay = delay;
        return 1 as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimeout: () => {},
      onTrigger: (noteId) => triggered.push(noteId),
    });

    scheduler.syncNote({
      id: 10,
      dueAt: new Date('2026-04-20T00:00:00.000Z'),
      reminderAt: null,
    });

    expect(capturedDelay).toBe(86_400_000);
    capturedFn();
    expect(triggered.join(',')).toBe('10');
  });

  it('does not schedule when target is in the past', () => {
    let called = false;
    const scheduler = new ReminderScheduler({
      now: () => Date.parse('2026-04-20T00:00:00.000Z'),
      setTimeout: () => {
        called = true;
        return 1 as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimeout: () => {},
    });

    scheduler.syncNote({
      id: 20,
      dueAt: new Date('2026-04-19T00:00:00.000Z'),
      reminderAt: null,
    });

    expect(called).toBe(false);
  });
});
