import { useMemo, useState } from 'react';

import type { SettingsDraftRegistry, SettingsDraftSnapshot } from './settings-drafts-context';
import { SETTINGS_TABS } from './settings-tabs';
import type { SettingsTab } from './settings-tabs';

export type SettingsDrafts = {
  registry: SettingsDraftRegistry;
  dirtyTabs: readonly SettingsTab[];
  hasChanges: boolean;
  saving: boolean;
  saveAll: () => Promise<void>;
};

export function useSettingsDrafts(): SettingsDrafts {
  const [snapshots, setSnapshots] = useState<Readonly<Record<string, SettingsDraftSnapshot>>>({});

  const registry = useMemo<SettingsDraftRegistry>(
    () => ({
      set: (id, snapshot) =>
        setSnapshots((current) => {
          if (snapshot !== null) {
            return { ...current, [id]: snapshot };
          }
          const next = { ...current };
          delete next[id];
          return next;
        }),
    }),
    [],
  );

  const all = Object.values(snapshots);
  const pending = all.filter((snapshot) => snapshot.dirty);

  async function saveAll() {
    for (const snapshot of pending) {
      await snapshot.save();
    }
  }

  return {
    registry,
    dirtyTabs: SETTINGS_TABS.filter((tab) => pending.some((snapshot) => snapshot.tab === tab)),
    hasChanges: pending.length > 0,
    saving: all.some((snapshot) => snapshot.saving),
    saveAll,
  };
}
