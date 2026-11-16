import { Link } from 'react-router-dom';

import { useT } from '../../i18n/language-context';
import { LanguageSwitch } from '../language-switch';
import { ServiceHealthBadge } from '../service-health-badge';
import { FOOTER_CONTROL_CLASS } from './footer-control-style';

export const APPEARANCE_SETTINGS_PATH = '/settings?tab=appearance';

export function SidebarFooter() {
  const t = useT();

  return (
    <div
      data-testid="sidebar-footer"
      className="glass-sub mt-1.5 flex shrink-0 flex-col gap-1.5 rounded-[12px] p-1.5 max-[1099px]:items-center"
    >
      <ServiceHealthBadge />
      <LanguageSwitch />
      <div className="max-[1099px]:hidden">
        <Link to={APPEARANCE_SETTINGS_PATH} data-testid="appearance-link" className={`${FOOTER_CONTROL_CLASS} py-1.5`}>
          <span className="min-w-0 flex-1 truncate">{t('shell.appearance')}</span>
          <span aria-hidden="true" className="shrink-0 text-[var(--cl-ink-3)]">
            ›
          </span>
        </Link>
      </div>
    </div>
  );
}
