import { createContext, useContext, useEffect, useRef } from 'react';

import type { SettingsTab } from './settings-tabs';

export type SettingsDraftSnapshot = {
  tab: SettingsTab;
  dirty: boolean;
  saving: boolean;
  save: () => Promise<void>;
};

export type SettingsDraftRegistry = {
  set: (id: string, snapshot: SettingsDraftSnapshot | null) => void;
};

const NO_OP_REGISTRY: SettingsDraftRegistry = { set: () => undefined };

export const SettingsDraftsContext = createContext<SettingsDraftRegistry>(NO_OP_REGISTRY);

export function useSettingsDraft(id: string, snapshot: SettingsDraftSnapshot): void {
  const registry = useContext(SettingsDraftsContext);
  const latestSave = useRef(snapshot.save);
  latestSave.current = snapshot.save;
  const { tab, dirty, saving } = snapshot;

  useEffect(() => {
    registry.set(id, { tab, dirty, saving, save: () => latestSave.current() });
    return () => registry.set(id, null);
  }, [registry, id, tab, dirty, saving]);
}
