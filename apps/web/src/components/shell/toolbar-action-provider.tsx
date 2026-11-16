import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { ToolbarActionContext } from './toolbar-action-context';
import type { ToolbarAction } from './toolbar-action-context';
import { ToolbarStatusContext } from './toolbar-status-context';

export function ToolbarActionProvider({ children }: { children: ReactNode }) {
  const [action, setAction] = useState<ToolbarAction | null>(null);
  const [statusElement, setStatusElement] = useState<HTMLElement | null>(null);
  const store = useMemo(() => ({ action, setAction }), [action]);
  const statusSlot = useMemo(() => ({ element: statusElement, setElement: setStatusElement }), [statusElement]);
  return (
    <ToolbarActionContext.Provider value={store}>
      <ToolbarStatusContext.Provider value={statusSlot}>{children}</ToolbarStatusContext.Provider>
    </ToolbarActionContext.Provider>
  );
}
