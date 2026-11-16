import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useReloadWhenVisible } from './use-reload-when-visible';

describe('useReloadWhenVisible', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reloads when the window comes back and every interval while visible, so another studio window stays in sync', () => {
    vi.useFakeTimers();
    const reload = vi.fn();
    const { unmount } = renderHook(() => useReloadWhenVisible(reload, 1000));

    window.dispatchEvent(new Event('focus'));
    expect(reload).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    expect(reload).toHaveBeenCalledTimes(2);

    unmount();
    window.dispatchEvent(new Event('focus'));
    vi.advanceTimersByTime(1000);
    expect(reload).toHaveBeenCalledTimes(2);
  });
});
