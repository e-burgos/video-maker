import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

const BOTTOM_THRESHOLD_PX = 40;

export type StickToBottom<Scroll extends HTMLElement, Content extends HTMLElement> = {
  scrollRef: RefObject<Scroll | null>;
  contentRef: RefObject<Content | null>;
  onScroll: () => void;
};

export function useStickToBottom<
  Scroll extends HTMLElement = HTMLDivElement,
  Content extends HTMLElement = HTMLDivElement,
>(): StickToBottom<Scroll, Content> {
  const scrollRef = useRef<Scroll>(null);
  const contentRef = useRef<Content>(null);
  const pinnedRef = useRef(true);

  useEffect(() => {
    const scroll = scrollRef.current;
    const content = contentRef.current;
    if (scroll === null || content === null || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver(() => {
      if (pinnedRef.current) {
        scroll.scrollTop = scroll.scrollHeight;
      }
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  function onScroll() {
    const scroll = scrollRef.current;
    if (scroll === null) {
      return;
    }
    pinnedRef.current = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < BOTTOM_THRESHOLD_PX;
  }

  return { scrollRef, contentRef, onScroll };
}
