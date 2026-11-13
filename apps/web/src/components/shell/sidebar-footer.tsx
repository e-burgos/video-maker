import { useState } from 'react';

import { useT } from '../../i18n/language-context';
import { ThemeSwitch } from '../../theme/theme-switch';
import { LanguageSwitch } from '../language-switch';
import { ServiceHealthBadge } from '../service-health-badge';
import { FOOTER_CONTROL_CLASS } from './footer-control-style';

const APPEARANCE_PANEL_ID = 'sidebar-appearance-panel';

export function SidebarFooter() {
  const t = useT();
  const [appearanceOpen, setAppearanceOpen] = useState(false);

  return (
    <div
      data-testid="sidebar-footer"
      className="glass-sub mt-2 flex flex-col gap-2 rounded-[12px] p-2 max-[1099px]:items-center"
    >
      <ServiceHealthBadge />
      <LanguageSwitch />
      <div className="max-[1099px]:hidden">
        <button
          type="button"
          data-testid="appearance-toggle"
          aria-expanded={appearanceOpen}
          aria-controls={APPEARANCE_PANEL_ID}
          onClick={() => setAppearanceOpen(!appearanceOpen)}
          className={`${FOOTER_CONTROL_CLASS} py-2`}
        >
          <span className="min-w-0 flex-1 truncate">{t('shell.appearance')}</span>
          <span
            aria-hidden="true"
            className={`shrink-0 text-[var(--cl-ink-3)] transition-transform ${appearanceOpen ? 'rotate-90' : ''}`}
          >
            ›
          </span>
        </button>
        {appearanceOpen && (
          <div id={APPEARANCE_PANEL_ID} className="pt-2">
            <ThemeSwitch />
          </div>
        )}
      </div>
    </div>
  );
}
