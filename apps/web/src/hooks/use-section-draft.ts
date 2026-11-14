import { useCallback, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

export type SectionDraft<T> = {
  draft: T;
  setDraft: Dispatch<SetStateAction<T>>;
  dirty: boolean;
};

type DraftState<T> = { savedKey: string; draft: T };

export function useSectionDraft<T>(saved: T): SectionDraft<T> {
  const savedKey = JSON.stringify(saved);
  const [state, setState] = useState<DraftState<T>>({ savedKey, draft: saved });

  let current = state;
  if (state.savedKey !== savedKey) {
    current = { savedKey, draft: saved };
    setState(current);
  }

  const setDraft = useCallback<Dispatch<SetStateAction<T>>>((next) => {
    setState((previous) => ({
      savedKey: previous.savedKey,
      draft: typeof next === 'function' ? (next as (value: T) => T)(previous.draft) : next,
    }));
  }, []);

  return { draft: current.draft, setDraft, dirty: JSON.stringify(current.draft) !== savedKey };
}
