import { StateBadge } from '@e-burgos/tucu-ui';

import type { RequirementCopy } from '../../content/about/about-content';
import { useT } from '../../i18n/language-context';
import { STATE_LABEL, STATE_TONE } from './requirements-model';
import type { RequirementItem } from './requirements-model';

export type RequirementRowProps = {
  item: RequirementItem;
  copy: RequirementCopy;
};

export function RequirementRow({ item, copy }: RequirementRowProps) {
  const t = useT();

  return (
    <li
      data-testid="about-requirement"
      data-requirement-id={item.id}
      data-state={item.state}
      className="glass-sub flex min-w-0 flex-col gap-1.5 rounded-[14px] p-3"
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-semibold text-[var(--cl-ink)]">{copy.label}</span>
          {item.envVar !== null && <span className="font-data text-[11px] text-[var(--cl-ink-3)]">{item.envVar}</span>}
        </div>
        <StateBadge tone={STATE_TONE[item.state]} dot size="sm" data-testid="about-requirement-state">
          {t(STATE_LABEL[item.state])}
        </StateBadge>
      </div>
      <p className="m-0 text-xs text-[var(--cl-ink-2)]">{copy.purpose}</p>
      <p className="m-0 text-xs text-[var(--cl-ink-2)]">
        <span className="font-semibold text-[var(--cl-ink)]">{t('about.requirements.howToFix')}: </span>
        {copy.fix}
      </p>
    </li>
  );
}
