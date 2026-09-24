import { useEffect, useState } from 'react';

export const WORKSPACE_WIDE_QUERY = '(min-width: 1100px)';

export function useIsWideViewport(query: string = WORKSPACE_WIDE_QUERY): boolean {
  const [isWide, setIsWide] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const media = window.matchMedia(query);
    setIsWide(media.matches);

    const listener = (event: MediaQueryListEvent) => setIsWide(event.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);

  return isWide;
}
