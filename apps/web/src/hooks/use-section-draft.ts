import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

export type SectionDraft<T> = {
  draft: T;
  setDraft: Dispatch<SetStateAction<T>>;
  dirty: boolean;
};

export function useSectionDraft<T>(saved: T): SectionDraft<T> {
  const savedKey = JSON.stringify(saved);
  const [draft, setDraft] = useState<T>(saved);
  const previousKey = useRef(savedKey);

  useEffect(() => {
    if (previousKey.current !== savedKey) {
      previousKey.current = savedKey;
      setDraft(saved);
    }
  }, [savedKey, saved]);

  return { draft, setDraft, dirty: JSON.stringify(draft) !== savedKey };
}
