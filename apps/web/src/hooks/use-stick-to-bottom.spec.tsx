import { fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useStickToBottom } from './use-stick-to-bottom';

type ResizeCallback = () => void;

function stubResizeObserver() {
  let callback: ResizeCallback = () => undefined;
  const observe = vi.fn();
  const disconnect = vi.fn();

  class FakeResizeObserver {
    constructor(cb: ResizeCallback) {
      callback = cb;
    }
    observe = observe;
    disconnect = disconnect;
  }

  vi.stubGlobal('ResizeObserver', FakeResizeObserver);

  return {
    fire: () => callback(),
    observe,
    disconnect,
  };
}

function Harness({ enabled }: { enabled?: boolean } = {}) {
  const { scrollRef, contentRef, onScroll } = useStickToBottom(enabled);
  return (
    <div ref={scrollRef} onScroll={onScroll} data-testid="scroll">
      <div ref={contentRef} data-testid="content" />
    </div>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useStickToBottom', () => {
  it('scrolls the container to the bottom when the content grows and the viewer is pinned', () => {
    const resizeObserver = stubResizeObserver();
    const { getByTestId } = render(<Harness />);

    const scroll = getByTestId('scroll') as HTMLDivElement;
    Object.defineProperty(scroll, 'scrollHeight', { value: 500, configurable: true });
    Object.defineProperty(scroll, 'clientHeight', { value: 200, configurable: true });
    scroll.scrollTop = 0;

    resizeObserver.fire();

    expect(scroll.scrollTop).toBe(500);
  });

  it('observes the content element and disconnects on unmount', () => {
    const resizeObserver = stubResizeObserver();
    const { getByTestId, unmount } = render(<Harness />);

    expect(resizeObserver.observe).toHaveBeenCalledWith(getByTestId('content'));

    unmount();

    expect(resizeObserver.disconnect).toHaveBeenCalled();
  });

  it('does nothing when ResizeObserver is unavailable, instead of crashing', () => {
    vi.stubGlobal('ResizeObserver', undefined);

    expect(() => render(<Harness />)).not.toThrow();
  });

  it('stops following the bottom once the viewer scrolls away from it', () => {
    const resizeObserver = stubResizeObserver();
    const { getByTestId } = render(<Harness />);

    const scroll = getByTestId('scroll') as HTMLDivElement;
    Object.defineProperty(scroll, 'scrollHeight', { value: 500, configurable: true });
    Object.defineProperty(scroll, 'clientHeight', { value: 200, configurable: true });
    scroll.scrollTop = 50;

    fireEvent.scroll(scroll);
    resizeObserver.fire();

    expect(scroll.scrollTop).toBe(50);
  });

  it('does not observe the content when disabled, so a welcome screen keeps its scroll position', () => {
    const resizeObserver = stubResizeObserver();
    render(<Harness enabled={false} />);

    expect(resizeObserver.observe).not.toHaveBeenCalled();
  });
});
