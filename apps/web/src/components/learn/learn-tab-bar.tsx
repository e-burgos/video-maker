import { SegmentedControl } from '@e-burgos/tucu-ui';

import { useT } from '../../i18n/language-context';
import { LEARN_TABS, LEARN_TAB_LABEL, LEARN_TABS_ID_BASE } from './learn-tabs';
import type { LearnTab } from './learn-tabs';

export type LearnTabBarProps = {
  active: LearnTab;
  onSelect: (tab: LearnTab) => void;
};

export function LearnTabBar({ active, onSelect }: LearnTabBarProps) {
  const t = useT();
  const options = LEARN_TABS.map((tab) => ({
    value: tab,
    'data-testid': `learn-tab-${tab}`,
    label: t(LEARN_TAB_LABEL[tab]),
  }));

  return (
    <div className="glass-thin max-w-full self-start overflow-x-auto rounded-[12px] p-[3px]">
      <SegmentedControl
        size="sm"
        semantics="tabs"
        idBase={LEARN_TABS_ID_BASE}
        aria-label={t('learn.tab.label')}
        options={options}
        value={active}
        onChange={(next) => onSelect(next as LearnTab)}
      />
    </div>
  );
}
