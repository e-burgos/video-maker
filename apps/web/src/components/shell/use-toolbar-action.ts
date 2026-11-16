import { useEffect, useRef } from 'react';

import { useToolbarActionSetter } from './toolbar-action-context';
import type { ToolbarAction } from './toolbar-action-context';

export function useToolbarAction(action: ToolbarAction | null): void {
  const setAction = useToolbarActionSetter();
  const latestOnClick = useRef(action?.onClick);
  latestOnClick.current = action?.onClick;

  const isDeclared = action !== null;
  const label = action?.label ?? '';
  const disabled = action?.disabled ?? false;
  const loading = action?.loading ?? false;

  useEffect(() => {
    if (!isDeclared) {
      return undefined;
    }
    setAction({ label, disabled, loading, onClick: () => latestOnClick.current?.() });
    return () => setAction(null);
  }, [isDeclared, label, disabled, loading, setAction]);
}
