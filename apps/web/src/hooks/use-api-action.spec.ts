import { act, renderHook } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { RenderApiError } from '../api/render-api-error';
import { useApiAction } from './use-api-action';

function errorFor(code: string, status: number): RenderApiError {
  return new RenderApiError(code, `${code} at ${status}`, status, null);
}

describe('useApiAction', () => {
  it('starts idle with no error', () => {
    const { result } = renderHook(() => useApiAction(() => Promise.resolve('ok')));

    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
  });

  it('resolves to ok and returns the value on success', async () => {
    const action = vi.fn().mockResolvedValue({ slug: 'demo', path: 'work/timeline.json' });
    const { result } = renderHook(() => useApiAction(action));

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.run();
    });

    expect(outcome).toEqual({ slug: 'demo', path: 'work/timeline.json' });
    expect(result.current.status).toBe('ok');
    expect(result.current.error).toBeNull();
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('is pending while the action is in flight', async () => {
    let resolveAction: (value: string) => void = () => undefined;
    const action = vi.fn<() => Promise<string>>().mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveAction = resolve;
        }),
    );
    const { result } = renderHook(() => useApiAction(action));

    let runPromise: Promise<string | null> = Promise.resolve(null);
    act(() => {
      runPromise = result.current.run();
    });

    expect(result.current.status).toBe('pending');
    expect(result.current.error).toBeNull();

    await act(async () => {
      resolveAction('done');
      await runPromise;
    });

    expect(result.current.status).toBe('ok');
  });

  it.each([
    ['REQUEST_BODY_INVALID_JSON', 400],
    ['PROJECT_NOT_FOUND', 404],
    ['REQUEST_BODY_TOO_LARGE', 413],
    ['TIMELINE_INVALID', 422],
  ])('never throws: run() returns null and exposes %s (%i) as a typed error', async (code, status) => {
    const typed = errorFor(code, status);
    const action = vi.fn().mockRejectedValue(typed);
    const { result } = renderHook(() => useApiAction(action));

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.run();
    });

    expect(outcome).toBeNull();
    expect(result.current.status).toBe('error');
    expect(result.current.error?.code).toBe(code);
    expect(result.current.error?.status).toBe(status);
  });

  it('wraps a non-RenderApiError rejection instead of throwing', async () => {
    const action = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useApiAction(action));

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.run();
    });

    expect(outcome).toBeNull();
    expect(result.current.status).toBe('error');
    expect(result.current.error?.code).toBe('SERVICE_UNREACHABLE');
  });

  it('reset() clears the error and returns to idle', async () => {
    const action = vi.fn().mockRejectedValue(errorFor('TIMELINE_INVALID', 422));
    const { result } = renderHook(() => useApiAction(action));

    await act(async () => {
      await result.current.run();
    });
    expect(result.current.status).toBe('error');

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
  });

  it('discards the stale outcome of an overlapping first run, keeping the second as the visible state', async () => {
    let resolveFirst: (value: string) => void = () => undefined;
    const action = vi
      .fn<() => Promise<string>>()
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce('second');

    const { result } = renderHook(() => useApiAction(action));

    let firstOutcome: string | null = null;
    act(() => {
      result.current.run().then((value) => {
        firstOutcome = value;
      });
    });

    await act(async () => {
      await result.current.run();
    });

    expect(result.current.status).toBe('ok');
    expect(result.current.error).toBeNull();

    await act(async () => {
      resolveFirst('first');
    });

    expect(firstOutcome).toBe('first');
    expect(result.current.status).toBe('ok');
  });

  it('does not update state after the component unmounts', async () => {
    let resolveAction: (value: string) => void = () => undefined;
    const action = vi.fn<() => Promise<string>>().mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveAction = resolve;
        }),
    );
    const { result, unmount } = renderHook(() => useApiAction(action));

    let runPromise: Promise<string | null> = Promise.resolve(null);
    act(() => {
      runPromise = result.current.run();
    });

    unmount();

    await act(async () => {
      resolveAction('late');
      await runPromise;
    });

    expect(action).toHaveBeenCalledTimes(1);
  });

  it('reaches ok after a StrictMode mount/unmount/remount cycle, not stuck pending forever', async () => {
    const action = vi.fn().mockResolvedValue('ok');
    const { result } = renderHook(() => useApiAction(action), { wrapper: StrictMode });

    await act(async () => {
      await result.current.run();
    });

    expect(result.current.status).toBe('ok');
    expect(result.current.error).toBeNull();

    await act(async () => {
      await result.current.run();
    });

    expect(result.current.status).toBe('ok');
  });
});
