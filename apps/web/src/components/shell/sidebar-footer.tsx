import { Collapse } from '@e-burgos/tucu-ui';

import { useT } from '../../i18n/language-context';
import { ThemeSwitch } from '../../theme/theme-switch';
import { LanguageSwitch } from '../language-switch';
import { ServiceHealthBadge } from '../service-health-badge';

export function SidebarFooter() {
  const t = useT();

  return (
    <div
      data-testid="sidebar-footer"
      className="glass-sub mt-2 flex flex-col gap-2 rounded-[12px] p-2 max-[1099px]:items-center max-[1099px]:[&_[data-testid=language-switch]]:flex-col"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 max-[1099px]:[&>*:first-child]:hidden">
        <ServiceHealthBadge />
        <LanguageSwitch />
      </div>
      <div className="max-[1099px]:hidden">
        <Collapse label={t('shell.appearance')} variant="compact">
          <ThemeSwitch />
        </Collapse>
      </div>
    </div>
  );
}
