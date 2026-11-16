import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

import { useToolbarStatusSlot } from './toolbar-status-context';

export function ToolbarStatus({ children }: { children: ReactNode }) {
  const { element } = useToolbarStatusSlot();
  return element === null ? null : createPortal(children, element);
}
