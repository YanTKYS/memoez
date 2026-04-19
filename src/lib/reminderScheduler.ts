import type { Note } from '@/domain/entities/Note';

type TimerId = ReturnType<typeof setTimeout>;

interface SchedulerDeps {
  now: () => number;
  setTimeout: (cb: () => void, delay: number) => TimerId;
  clearTimeout: (id: TimerId) => void;
  onTrigger?: (noteId: number) => void;
}

const defaultDeps: SchedulerDeps = {
  now: () => Date.now(),
  setTimeout: (cb, delay) => setTimeout(cb, delay),
  clearTimeout: (id) => clearTimeout(id),
};

function reminderTargetAt(note: Pick<Note, 'dueAt' | 'reminderAt'>): Date | null {
  return note.reminderAt ?? note.dueAt;
}

/**
 * 通知基盤の抽象レイヤ。
 * 現状は in-memory タイマーで管理し、将来的に expo-notifications へ差し替える。
 */
export class ReminderScheduler {
  private timers = new Map<number, TimerId>();

  constructor(private readonly deps: SchedulerDeps = defaultDeps) {}

  syncNote(note: Pick<Note, 'id' | 'dueAt' | 'reminderAt'>): void {
    this.cancel(note.id);

    const target = reminderTargetAt(note);
    if (!target) return;

    const delay = target.getTime() - this.deps.now();
    if (delay <= 0) return;

    const timerId = this.deps.setTimeout(() => {
      this.timers.delete(note.id);
      this.deps.onTrigger?.(note.id);
    }, delay);

    this.timers.set(note.id, timerId);
  }

  cancel(noteId: number): void {
    const timerId = this.timers.get(noteId);
    if (!timerId) return;
    this.deps.clearTimeout(timerId);
    this.timers.delete(noteId);
  }

  clearAll(): void {
    for (const timerId of this.timers.values()) {
      this.deps.clearTimeout(timerId);
    }
    this.timers.clear();
  }
}

export const reminderScheduler = new ReminderScheduler();

