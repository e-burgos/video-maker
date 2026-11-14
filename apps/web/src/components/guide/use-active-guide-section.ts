import { useEffect, useState } from 'react';

const ACTIVE_BAND_MARGIN = '-10% 0px -75% 0px';

function initialSectionId(ids: readonly string[]): string | null {
  const fromHash = window.location.hash.slice(1);
  return ids.includes(fromHash) ? fromHash : (ids[0] ?? null);
}

export function useActiveGuideSection(ids: readonly string[]): [string | null, (id: string) => void] {
  const [picked, setActive] = useState<string | null>(null);
  const active = picked !== null && ids.includes(picked) ? picked : initialSectionId(ids);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const topmost = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)[0];
        if (topmost !== undefined) {
          setActive(topmost.target.id);
        }
      },
      { rootMargin: ACTIVE_BAND_MARGIN },
    );
    ids.forEach((id) => {
      const element = document.getElementById(id);
      if (element !== null) {
        observer.observe(element);
      }
    });
    return () => observer.disconnect();
  }, [ids]);

  return [active, setActive];
}
