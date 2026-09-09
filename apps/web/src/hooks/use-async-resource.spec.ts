import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RenderApiError } from '../api/render-api-error';
import { useAsyncResource } from './use-async-resource';

describe('useAsyncResource', () => {
  it('starts loading and settles on the resolved value', async () => {
    const load = vi.fn().mockResolvedValue(['a']);
    const { result } = renderHook(() => useAsyncResource(load, 'key'));

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.data).toEqual(['a']);
    expect(result.current.error).toBeNull();
  });

  it('keeps a RenderApiError as-is and wraps anything else', async () => {
    const typed = new RenderApiError('PROJECT_NOT_FOUND', 'gone', 404, null);
    const { result: first } = renderHook(() => useAsyncResource(() => Promise.reject(typed), 'a'));
    await waitFor(() => expect(first.current.status).toBe('error'));
    expect(first.current.error).toBe(typed);

    const { result: second } = renderHook(() =>
      useAsyncResource(() => Promise.reject(new TypeError('Failed to fetch')), 'b'),
    );
    await waitFor(() => expect(second.current.status).toBe('error'));
    expect(second.current.error?.code).toBe('SERVICE_UNREACHABLE');
  });

  it('re-runs the loader on reload', async () => {
    const load = vi.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second');
    const { result } = renderHook(() => useAsyncResource(load, 'key'));

    await waitFor(() => expect(result.current.data).toBe('first'));
    act(() => {
      result.current.reload();
    });
    await waitFor(() => expect(result.current.data).toBe('second'));
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('re-runs the loader when the key changes', async () => {
    const load = vi.fn().mockResolvedValue('value');
    const { rerender } = renderHook(({ key }: { key: string }) => useAsyncResource(load, key), {
      initialProps: { key: 'a' },
    });

    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    rerender({ key: 'b' });
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  });

  it('discards the answer of a stale request', async () => {
    let resolveFirst: (value: string) => void = () => undefined;
    const load = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(() => Promise.resolve('second'));

    const { result } = renderHook(() => useAsyncResource(load, 'key'));
    act(() => {
      result.current.reload();
    });
    await waitFor(() => expect(result.current.data).toBe('second'));

    act(() => {
      resolveFirst('first');
    });
    await waitFor(() => expect(result.current.data).toBe('second'));
  });

  it('changing the key always blanks to loading even when the previous key had data', async () => {
    const load = vi.fn().mockResolvedValue('value-for-a');
    const { result, rerender } = renderHook(({ key }: { key: string }) => useAsyncResource(load, key), {
      initialProps: { key: 'a' },
    });

    await waitFor(() => expect(result.current.data).toBe('value-for-a'));

    rerender({ key: 'b' });

    expect(result.current.status).toBe('loading');
    expect(result.current.data).toBeNull();
    expect(result.current.isRefreshing).toBe(false);
  });

  it('reload() keeps the previous data and flags isRefreshing while the request is in flight, never dropping back to loading', async () => {
    let resolveSecond: (value: string) => void = () => undefined;
    const load = vi
      .fn()
      .mockResolvedValueOnce('first')
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            resolveSecond = resolve;
          }),
      );

    const { result } = renderHook(() => useAsyncResource(load, 'key'));
    await waitFor(() => expect(result.current.data).toBe('first'));
    expect(result.current.isRefreshing).toBe(false);

    act(() => {
      result.current.reload();
    });

    expect(result.current.status).toBe('ready');
    expect(result.current.data).toBe('first');
    expect(result.current.isRefreshing).toBe(true);

    act(() => {
      resolveSecond('second');
    });

    await waitFor(() => expect(result.current.data).toBe('second'));
    expect(result.current.status).toBe('ready');
    expect(result.current.isRefreshing).toBe(false);
  });

  it('a failed refresh keeps the previous data and exposes the error while status stays ready', async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce('first')
      .mockRejectedValueOnce(new RenderApiError('SERVICE_UNREACHABLE', 'down', null, null));

    const { result } = renderHook(() => useAsyncResource(load, 'key'));
    await waitFor(() => expect(result.current.data).toBe('first'));

    act(() => {
      result.current.reload();
    });

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.status).toBe('ready');
    expect(result.current.data).toBe('first');
    expect(result.current.isRefreshing).toBe(false);
  });

  it('an initial load failure has no previous data to keep, so status becomes error with isRefreshing false', async () => {
    const typed = new RenderApiError('PROJECT_NOT_FOUND', 'gone', 404, null);
    const { result } = renderHook(() => useAsyncResource(() => Promise.reject(typed), 'key'));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.data).toBeNull();
    expect(result.current.isRefreshing).toBe(false);
  });

  it('reload() while data is still null stays in loading instead of switching to refreshing', async () => {
    let resolveFirst: (value: string) => void = () => undefined;
    const load = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce('second');

    const { result } = renderHook(() => useAsyncResource(load, 'key'));
    expect(result.current.status).toBe('loading');
    expect(result.current.data).toBeNull();

    act(() => {
      result.current.reload();
    });

    expect(result.current.status).toBe('loading');
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isRefreshing).toBe(false);

    await waitFor(() => expect(result.current.data).toBe('second'));

    act(() => {
      resolveFirst('stale-initial');
    });
    await waitFor(() => expect(result.current.data).toBe('second'));
  });

  it('discards a stale refresh response and keeps the winning data', async () => {
    let resolveFirstRefresh: (value: string) => void = () => undefined;
    const load = vi
      .fn()
      .mockResolvedValueOnce('first')
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            resolveFirstRefresh = resolve;
          }),
      )
      .mockResolvedValueOnce('third');

    const { result } = renderHook(() => useAsyncResource(load, 'key'));
    await waitFor(() => expect(result.current.data).toBe('first'));

    act(() => {
      result.current.reload();
    });
    act(() => {
      result.current.reload();
    });

    await waitFor(() => expect(result.current.data).toBe('third'));

    act(() => {
      resolveFirstRefresh('stale-refresh');
    });

    await waitFor(() => expect(result.current.data).toBe('third'));
  });
});
