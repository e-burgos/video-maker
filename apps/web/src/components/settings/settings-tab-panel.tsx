import { segmentedControlPanelId, segmentedControlTabId } from '@e-burgos/tucu-ui';
import type { ReactNode } from 'react';

import { SETTINGS_TABS_ID_BASE } from './settings-tabs';
import type { SettingsTab } from './settings-tabs';

export type SettingsTabPanelProps = {
  tab: SettingsTab;
  active: SettingsTab;
  children: ReactNode;
};

export function SettingsTabPanel({ tab, active, children }: SettingsTabPanelProps) {
  return (
    <div
      role="tabpanel"
      id={segmentedControlPanelId(SETTINGS_TABS_ID_BASE, tab)}
      aria-labelledby={segmentedControlTabId(SETTINGS_TABS_ID_BASE, tab)}
      data-testid={`settings-panel-${tab}`}
      hidden={tab !== active}
      className="grid items-start gap-3 min-[1100px]:grid-cols-2"
    >
      {children}
    </div>
  );
}
