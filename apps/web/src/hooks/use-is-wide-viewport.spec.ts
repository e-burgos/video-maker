import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useIsWideViewport } from './use-is-wide-viewport';

type Listener = (event: MediaQueryListEvent) => void;

function stubMatchMedia(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<Listener>();

  const mediaQueryList = {
    get matches() {
      return matches;
    },
    media: '(min-width: 1100px)',
    addEventListener: vi.fn((_type: string, listener: Listener) => listeners.add(listener)),
    removeEventListener: vi.fn((_type: string, listener: Listener) => listeners.delete(listener)),
  };

  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => mediaQueryList),
  );

  return {
    setMatches(next: boolean) {
      matches = next;
      for (const listener of listeners) {
        listener({ matches: next } as MediaQueryListEvent);
      }
    },
    mediaQueryList,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useIsWideViewport', () => {
  it('reads the initial match synchronously', () => {
    stubMatchMedia(true);

    const { result } = renderHook(() => useIsWideViewport());

    expect(result.current).toBe(true);
  });

  it('reacts to a later change event', () => {
    const media = stubMatchMedia(false);

    const { result } = renderHook(() => useIsWideViewport());
    expect(result.current).toBe(false);

    act(() => {
      media.setMatches(true);
    });

    expect(result.current).toBe(true);
  });

  it('removes its listener on unmount', () => {
    const media = stubMatchMedia(true);

    const { unmount } = renderHook(() => useIsWideViewport());
    unmount();

    expect(media.mediaQueryList.removeEventListener).toHaveBeenCalled();
  });
});
