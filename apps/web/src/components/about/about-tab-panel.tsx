import { segmentedControlPanelId, segmentedControlTabId } from '@e-burgos/tucu-ui';
import type { ReactNode } from 'react';

import { ABOUT_TABS_ID_BASE } from './about-tabs';
import type { AboutTab } from './about-tabs';

export type AboutTabPanelProps = {
  tab: AboutTab;
  children: ReactNode;
};

export function AboutTabPanel({ tab, children }: AboutTabPanelProps) {
  return (
    <div
      role="tabpanel"
      id={segmentedControlPanelId(ABOUT_TABS_ID_BASE, tab)}
      aria-labelledby={segmentedControlTabId(ABOUT_TABS_ID_BASE, tab)}
      data-testid={`about-panel-${tab}`}
      className="flex min-w-0 flex-col gap-4"
    >
      {children}
    </div>
  );
}
