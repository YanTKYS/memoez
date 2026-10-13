import { notifyNotesChanged, subscribeNotesChanged } from '@/lib/noteChangeEvents';

describe('noteChangeEvents', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('coalesces a burst of changes (e.g. an import) into one notification', () => {
    const listener = jest.fn();
    const off = subscribeNotesChanged(listener);

    notifyNotesChanged();
    notifyNotesChanged();
    notifyNotesChanged();
    expect(listener).not.toHaveBeenCalled();

    jest.advanceTimersByTime(200);
    expect(listener).toHaveBeenCalledTimes(1);

    notifyNotesChanged();
    jest.advanceTimersByTime(200);
    expect(listener).toHaveBeenCalledTimes(2);
    off();
  });

  it('stops notifying after unsubscribe', () => {
    const listener = jest.fn();
    const off = subscribeNotesChanged(listener);
    off();

    notifyNotesChanged();
    jest.advanceTimersByTime(200);
    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps notifying other listeners when one of them throws', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const broken = jest.fn(() => { throw new Error('boom'); });
    const healthy = jest.fn();
    const offBroken  = subscribeNotesChanged(broken);
    const offHealthy = subscribeNotesChanged(healthy);

    notifyNotesChanged();
    jest.advanceTimersByTime(200);
    expect(healthy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalled();

    offBroken();
    offHealthy();
    jest.restoreAllMocks();
  });
});
