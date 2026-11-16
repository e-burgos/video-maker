import { StateBadge } from '@e-burgos/tucu-ui';
import type { StateBadgeTone } from '@e-burgos/tucu-ui';

import { assetRoleCopy } from '../../api/asset-roles';
import { useT, useTn } from '../../i18n/language-context';
import type { TranslationKey } from '../../i18n/messages-en';
import type { RoleSummaryEntry, RoleSummaryStatus } from './library-model';

const STATUS_TONE: Readonly<Record<RoleSummaryStatus, StateBadgeTone>> = {
  complete: 'green',
  missing: 'orange',
  review: 'orange',
  empty: 'neutral',
};

const STATUS_KEY: Readonly<Record<RoleSummaryStatus, TranslationKey>> = {
  complete: 'library.summary.complete',
  missing: 'library.summary.missing',
  review: 'library.summary.review',
  empty: 'library.summary.empty',
};

export function RoleSummary({
  entries,
}: {
  entries: readonly RoleSummaryEntry[];
}) {
  const t = useT();
  const tn = useTn();

  return (
    <ul
      data-testid="library-summary"
      aria-label={t('library.summary.label')}
      className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-3 p-0"
    >
      {entries.map((entry) => (
        <li
          key={entry.role}
          data-testid="library-summary-role"
          data-role={entry.role}
          data-status={entry.status}
          className="glass flex min-w-0 flex-col gap-1.5 rounded-[16px] p-3"
        >
          <p className="m-0 truncate text-sm font-bold text-[var(--cl-ink)]">
            {t(assetRoleCopy(entry.role).shortNameKey)}
          </p>
          <p className="m-0 text-xs text-[var(--cl-ink-2)]">
            {tn('workspace.material.fileCount', entry.count)}
          </p>
          <StateBadge tone={STATUS_TONE[entry.status]} dot size="sm">
            {t(STATUS_KEY[entry.status])}
          </StateBadge>
        </li>
      ))}
    </ul>
  );
}
