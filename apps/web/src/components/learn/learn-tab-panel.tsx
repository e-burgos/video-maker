import { segmentedControlPanelId, segmentedControlTabId } from '@e-burgos/tucu-ui';
import type { ReactNode } from 'react';

import { LEARN_TABS_ID_BASE } from './learn-tabs';
import type { LearnTab } from './learn-tabs';

export type LearnTabPanelProps = {
  tab: LearnTab;
  children: ReactNode;
};

export function LearnTabPanel({ tab, children }: LearnTabPanelProps) {
  return (
    <div
      role="tabpanel"
      id={segmentedControlPanelId(LEARN_TABS_ID_BASE, tab)}
      aria-labelledby={segmentedControlTabId(LEARN_TABS_ID_BASE, tab)}
      data-testid={`learn-panel-${tab}`}
      className="flex min-w-0 flex-col gap-4"
    >
      {children}
    </div>
  );
}
