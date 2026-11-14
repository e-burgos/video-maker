import { StateBadge } from '@e-burgos/tucu-ui';

import type { TechItem } from '../../content/about/tech-inventory';
import { DISTRIBUTION_LABELS } from '../../content/about/tech-inventory';
import type { Language } from '../../i18n/language';
import { useT } from '../../i18n/language-context';
import { LINK_CLASS } from '../ui/cl-controls';
import { InlinePartsView } from './inline-parts-view';
import { splitBackticks } from './inline-parts';

export type TechItemCardProps = {
  item: TechItem;
  language: Language;
};

export function TechItemCard({ item, language }: TechItemCardProps) {
  const t = useT();

  return (
    <li
      data-testid="about-tech-item"
      data-tech-id={item.id}
      className="glass-sub flex min-w-0 flex-col gap-1.5 rounded-[14px] p-3"
    >
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('about.licenses.openSite', { name: item.name })}
          className={`${LINK_CLASS} text-sm font-semibold`}
        >
          {item.name}
        </a>
        {item.version !== null && <span className="font-data text-[11px] text-[var(--cl-ink-3)]">{item.version}</span>}
      </div>
      <p className="m-0 text-xs text-[var(--cl-ink-2)]">
        <InlinePartsView parts={splitBackticks(item.what[language])} />
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
        <StateBadge tone="neutral" size="sm" aria-label={t('about.licenses.license')}>
          {item.license[language]}
        </StateBadge>
        <span className="text-[11px] text-[var(--cl-ink-3)]">{DISTRIBUTION_LABELS[item.distribution][language]}</span>
      </div>
      {item.warning !== null && <p className="m-0 text-[11px] text-[var(--tucu-state-orange-ink)]">{item.warning[language]}</p>}
    </li>
  );
}
