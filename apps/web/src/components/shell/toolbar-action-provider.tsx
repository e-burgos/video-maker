import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { ToolbarActionContext } from './toolbar-action-context';
import type { ToolbarAction } from './toolbar-action-context';

export function ToolbarActionProvider({ children }: { children: ReactNode }) {
  const [action, setAction] = useState<ToolbarAction | null>(null);
  const store = useMemo(() => ({ action, setAction }), [action]);
  return <ToolbarActionContext.Provider value={store}>{children}</ToolbarActionContext.Provider>;
}
