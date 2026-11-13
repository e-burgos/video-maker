import { LucideIcons } from '@e-burgos/tucu-ui';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

import { useT } from '../../i18n/language-context';
import { BrandMark, BrandWordmark } from '../ui/brand-mark';
import { SIDEBAR_SECTIONS } from './shell-navigation';
import type { SidebarItem } from './shell-navigation';
import { SidebarFooter } from './sidebar-footer';

export type ShellSidebarProps = {
  videoBlock: ReactNode;
};

function itemClass({ isActive }: { isActive: boolean }): string {
  const tone = isActive
    ? 'bg-[color-mix(in_srgb,var(--cl-action)_12%,transparent)] font-semibold text-[var(--cl-action)]'
    : 'font-medium text-[var(--cl-ink-2)] hover:bg-[color-mix(in_srgb,var(--cl-ink)_6%,transparent)]';
  return `focus-cl flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13.5px] first-letter:uppercase max-[1099px]:justify-center max-[1099px]:px-0 ${tone}`;
}

function SidebarLink({ item }: { item: SidebarItem }) {
  const t = useT();
  const Icon = LucideIcons[item.icon];
  const label = t(item.labelKey);
  return (
    <NavLink to={item.to} end={item.end} data-testid={item.testId} title={label} className={itemClass}>
      <Icon aria-hidden size={17} className="shrink-0" />
      <span className="max-[1099px]:sr-only first-letter:uppercase">{label}</span>
    </NavLink>
  );
}

export function ShellSidebar({ videoBlock }: ShellSidebarProps) {
  const t = useT();

  return (
    <aside
      data-testid="shell-sidebar"
      className="glass relative z-30 m-3 mr-0 flex w-[236px] shrink-0 flex-col gap-0.5 rounded-[20px] px-3 py-4 shadow-[var(--tucu-shadow-panel)] max-[1099px]:w-[72px] max-[1099px]:px-2"
    >
      <div
        data-testid="shell-sidebar-brand"
        className="flex items-center gap-2.5 px-2 pb-3.5 pt-1 text-[var(--cl-ink)] max-[1099px]:justify-center max-[1099px]:px-0"
      >
        <BrandMark label={t('brand.name')} size={28} />
        <BrandWordmark
          label={t('brand.nameWithSignature')}
          height={30}
          className="max-[1099px]:hidden"
        />
      </div>
      <nav aria-label={t('nav.label')} className="flex min-h-0 flex-1 flex-col gap-0.5">
        {SIDEBAR_SECTIONS.map((section) => (
          <div key={section.id} className="flex flex-col gap-0.5">
            <p className="font-data px-2.5 pb-1.5 pt-3.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--cl-ink-3)] max-[1099px]:hidden">
              {t(section.labelKey)}
            </p>
            {section.items.map((item) => (
              <div key={item.to} className="flex flex-col">
                <SidebarLink item={item} />
                {item.to === '/' && <div className="max-[1099px]:hidden">{videoBlock}</div>}
              </div>
            ))}
          </div>
        ))}
      </nav>
      <SidebarFooter />
    </aside>
  );
}
