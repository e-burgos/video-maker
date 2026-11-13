import { createContext, useContext } from 'react';

export type ToolbarAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
};

export type ToolbarActionStore = {
  action: ToolbarAction | null;
  setAction: (action: ToolbarAction | null) => void;
};

const NO_OP_STORE: ToolbarActionStore = { action: null, setAction: () => undefined };

export const ToolbarActionContext = createContext<ToolbarActionStore>(NO_OP_STORE);

export function useDeclaredToolbarAction(): ToolbarAction | null {
  return useContext(ToolbarActionContext).action;
}

export function useToolbarActionSetter(): ToolbarActionStore['setAction'] {
  return useContext(ToolbarActionContext).setAction;
}
