import { describe, expect, it, vi } from 'vitest';

import {
  PARENT_PID_ENV_VAR,
  isProcessAlive,
  readParentPid,
  startParentWatchdog,
} from './parent-watchdog';

describe('readParentPid', () => {
  it('parses a positive integer pid from the env var', () => {
    expect(readParentPid({ [PARENT_PID_ENV_VAR]: '4242' })).toBe(4242);
  });

  it('is null when the env var is missing, empty, or not a positive integer', () => {
    expect(readParentPid({})).toBeNull();
    expect(readParentPid({ [PARENT_PID_ENV_VAR]: '' })).toBeNull();
    expect(readParentPid({ [PARENT_PID_ENV_VAR]: '0' })).toBeNull();
    expect(readParentPid({ [PARENT_PID_ENV_VAR]: '-1' })).toBeNull();
    expect(readParentPid({ [PARENT_PID_ENV_VAR]: 'not-a-pid' })).toBeNull();
  });
});

describe('isProcessAlive', () => {
  it('is true for the current process', () => {
    expect(isProcessAlive(process.pid)).toBe(true);
  });

  it('is false for a pid that plainly does not exist', () => {
    expect(isProcessAlive(999_999)).toBe(false);
  });
});

describe('startParentWatchdog', () => {
  it('never polls, and returns a no-op stop, when the env var is absent (dev mode without a parent)', () => {
    const setIntervalFn = vi.fn();
    const onParentGone = vi.fn();

    const stop = startParentWatchdog({}, onParentGone, { setIntervalFn });

    expect(setIntervalFn).not.toHaveBeenCalled();
    expect(() => stop()).not.toThrow();
  });

  it('polls isAlive on the configured interval and does nothing while the parent lives', () => {
    let scheduled: (() => void) | null = null;
    const setIntervalFn = vi.fn((callback: () => void) => {
      scheduled = callback;
      return 1 as unknown as NodeJS.Timeout;
    });
    const clearIntervalFn = vi.fn();
    const isAlive = vi.fn().mockReturnValue(true);
    const onParentGone = vi.fn();

    startParentWatchdog(
      { [PARENT_PID_ENV_VAR]: '4242' },
      onParentGone,
      { setIntervalFn, clearIntervalFn, isAlive, pollIntervalMs: 2000 },
    );

    expect(setIntervalFn).toHaveBeenCalledWith(expect.any(Function), 2000);
    scheduled?.();
    scheduled?.();

    expect(isAlive).toHaveBeenCalledTimes(2);
    expect(isAlive).toHaveBeenCalledWith(4242);
    expect(onParentGone).not.toHaveBeenCalled();
    expect(clearIntervalFn).not.toHaveBeenCalled();
  });

  it('stops polling and fires onParentGone exactly once the parent disappears', () => {
    let scheduled: (() => void) | null = null;
    const setIntervalFn = vi.fn((callback: () => void) => {
      scheduled = callback;
      return 7 as unknown as NodeJS.Timeout;
    });
    const clearIntervalFn = vi.fn();
    const isAlive = vi.fn().mockReturnValue(false);
    const onParentGone = vi.fn();

    startParentWatchdog(
      { [PARENT_PID_ENV_VAR]: '4242' },
      onParentGone,
      { setIntervalFn, clearIntervalFn, isAlive },
    );

    scheduled?.();

    expect(onParentGone).toHaveBeenCalledTimes(1);
    expect(clearIntervalFn).toHaveBeenCalledWith(7);
  });

  it('the returned stop function clears the interval', () => {
    const clearIntervalFn = vi.fn();
    const setIntervalFn = vi.fn().mockReturnValue(9 as unknown as NodeJS.Timeout);

    const stop = startParentWatchdog(
      { [PARENT_PID_ENV_VAR]: '4242' },
      () => undefined,
      { setIntervalFn, clearIntervalFn, isAlive: () => true },
    );
    stop();

    expect(clearIntervalFn).toHaveBeenCalledWith(9);
  });
});
