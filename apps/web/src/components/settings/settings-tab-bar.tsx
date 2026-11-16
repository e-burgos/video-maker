import { SegmentedControl } from '@e-burgos/tucu-ui';

import { useT } from '../../i18n/language-context';
import { SETTINGS_TABS, SETTINGS_TAB_LABEL, SETTINGS_TABS_ID_BASE } from './settings-tabs';
import type { SettingsTab } from './settings-tabs';

export type SettingsTabBarProps = {
  active: SettingsTab;
  dirtyTabs: readonly SettingsTab[];
  onSelect: (tab: SettingsTab) => void;
};

export function SettingsTabBar({ active, dirtyTabs, onSelect }: SettingsTabBarProps) {
  const t = useT();
  const options = SETTINGS_TABS.map((tab) => {
    const changed = dirtyTabs.includes(tab);
    return {
      value: tab,
      'data-testid': `settings-tab-${tab}`,
      label: (
        <span className="inline-flex items-center gap-1.5" data-changed={changed}>
          {t(SETTINGS_TAB_LABEL[tab])}
          {changed && (
            <>
              <span aria-hidden className="size-2 shrink-0 rounded-full bg-[var(--tucu-state-orange-ink)]" />
              <span className="sr-only">{t('settings.tab.changed')}</span>
            </>
          )}
        </span>
      ),
    };
  });

  return (
    <div className="glass-thin max-w-full self-start overflow-x-auto rounded-[12px] p-[3px]">
      <SegmentedControl
        size="sm"
        semantics="tabs"
        idBase={SETTINGS_TABS_ID_BASE}
        aria-label={t('settings.tab.label')}
        options={options}
        value={active}
        onChange={(next) => onSelect(next as SettingsTab)}
      />
    </div>
  );
}
