import { SegmentedControl } from '@e-burgos/tucu-ui';

import { useT } from '../../i18n/language-context';
import { ABOUT_TABS, ABOUT_TAB_LABEL, ABOUT_TABS_ID_BASE } from './about-tabs';
import type { AboutTab } from './about-tabs';

export type AboutTabBarProps = {
  active: AboutTab;
  onSelect: (tab: AboutTab) => void;
};

export function AboutTabBar({ active, onSelect }: AboutTabBarProps) {
  const t = useT();
  const options = ABOUT_TABS.map((tab) => ({
    value: tab,
    'data-testid': `about-tab-${tab}`,
    label: t(ABOUT_TAB_LABEL[tab]),
  }));

  return (
    <div className="glass-thin max-w-full self-start overflow-x-auto rounded-[12px] p-[3px]">
      <SegmentedControl
        size="sm"
        semantics="tabs"
        idBase={ABOUT_TABS_ID_BASE}
        aria-label={t('about.tab.label')}
        options={options}
        value={active}
        onChange={(next) => onSelect(next as AboutTab)}
      />
    </div>
  );
}
