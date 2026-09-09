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
});
