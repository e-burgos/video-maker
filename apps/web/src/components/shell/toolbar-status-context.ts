import { createContext, useContext } from 'react';

export type ToolbarStatusSlot = {
  element: HTMLElement | null;
  setElement: (element: HTMLElement | null) => void;
};

const NO_OP_SLOT: ToolbarStatusSlot = { element: null, setElement: () => undefined };

export const ToolbarStatusContext = createContext<ToolbarStatusSlot>(NO_OP_SLOT);

export function useToolbarStatusSlot(): ToolbarStatusSlot {
  return useContext(ToolbarStatusContext);
}
