import { StateBadge } from '@e-burgos/tucu-ui';
import type { StateBadgeTone } from '@e-burgos/tucu-ui';
import { canonicalMaterialPath, hasMaterialWarnings } from '@video-maker/timeline-core';
import type { MaterialReview, MaterialReviewItem, MaterialVerdict, MaterialWarnings } from '@video-maker/timeline-core';

import { artifactUrl } from '../api/artifact-url';
import { useT } from '../i18n/language-context';
import type { TranslationKey } from '../i18n/messages-en';

const VERDICT_TONE: Readonly<Record<MaterialVerdict, StateBadgeTone>> = {
  fits: 'green',
  doubtful: 'orange',
  unfit: 'red',
};

const BRAND_PREFIX = 'brand:';

function VerdictChip({ verdict }: { verdict: MaterialVerdict }) {
  const t = useT();

  return (
    <StateBadge tone={VERDICT_TONE[verdict]} dot size="sm" data-verdict={verdict}>
      {t(`proposal.material.${verdict}` as TranslationKey)}
    </StateBadge>
  );
}

function MaterialThumb({ slug, item }: { slug: string; item: MaterialReviewItem }) {
  const t = useT();

  if (item.source === 'brand') {
    return (
      <span className="glass-sub rounded-[10px] px-2 py-1 font-data text-[11px] text-[var(--cl-ink-2)]">
        {t('proposal.material.brandImage', { key: item.file.slice(BRAND_PREFIX.length) })}
      </span>
    );
  }

  return (
    <img
      src={artifactUrl(slug, canonicalMaterialPath(item.file))}
      alt={item.file}
      loading="lazy"
      className="h-16 w-24 shrink-0 rounded-[10px] bg-[#0b0d14] object-cover"
    />
  );
}

export function MaterialWarningsBlock({ slug, warnings }: { slug: string; warnings: MaterialWarnings }) {
  const t = useT();

  if (!hasMaterialWarnings(warnings)) {
    return null;
  }

  return (
    <section
      data-testid="material-warnings"
      role="alert"
      className="space-y-3 rounded-[12px] border border-[var(--tucu-state-orange-line)] bg-[var(--tucu-state-orange-soft)] p-3"
    >
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-[var(--tucu-state-orange-ink)]">{t('proposal.material.heading')}</h3>
        <p className="text-xs text-[var(--cl-ink-2)]">{t('proposal.material.intro')}</p>
      </div>
      {warnings.items.length > 0 && (
        <ul className="space-y-2">
          {warnings.items.map((item) => (
            <li key={item.file} data-testid="material-warning-item" data-verdict={item.verdict} className="flex gap-3">
              <MaterialThumb slug={slug} item={item} />
              <div className="min-w-0 space-y-0.5 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <VerdictChip verdict={item.verdict} />
                  <span className="break-all font-data text-[var(--cl-ink-3)]">{item.file}</span>
                </div>
                <p className="text-[var(--cl-ink)]">{t('proposal.material.shows', { shows: item.shows })}</p>
                <p className="text-[var(--cl-ink-2)]">{item.reason}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {warnings.gaps.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-medium text-[var(--cl-ink)]">{t('proposal.material.gapsHeading')}</h4>
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-[var(--cl-ink-2)]">
            {warnings.gaps.map((gap) => (
              <li key={gap.need} data-testid="material-gap">
                {t('proposal.material.gap', { need: gap.need, note: gap.note })}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function MaterialReviewTable({ review }: { review: MaterialReview }) {
  const t = useT();

  if (review.items.length === 0) {
    return null;
  }

  return (
    <details data-testid="material-review-table" className="rounded-[12px] border border-[var(--tucu-glass-sub-line)] p-2">
      <summary className="cursor-pointer text-xs text-[var(--cl-ink-2)]">
        {t('proposal.material.tableSummary', { count: review.items.length })}
      </summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-[var(--cl-ink-3)]">
            <tr>
              <th className="pb-1 pr-2 font-medium">{t('proposal.material.col.file')}</th>
              <th className="pb-1 pr-2 font-medium">{t('proposal.material.col.shows')}</th>
              <th className="pb-1 pr-2 font-medium">{t('proposal.material.col.verdict')}</th>
              <th className="pb-1 font-medium">{t('proposal.material.col.useFor')}</th>
            </tr>
          </thead>
          <tbody>
            {review.items.map((item) => (
              <tr key={item.file} data-testid="material-review-row" className="align-top">
                <td className="break-all py-1 pr-2 font-data text-[var(--cl-ink-3)]">{item.file}</td>
                <td className="py-1 pr-2 text-[var(--cl-ink)]">{item.shows}</td>
                <td className="py-1 pr-2">
                  <VerdictChip verdict={item.verdict} />
                </td>
                <td className="py-1 text-[var(--cl-ink-2)]">{item.useFor ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function MaterialNotReviewedNote() {
  const t = useT();

  return (
    <p data-testid="material-not-reviewed" className="text-xs text-[var(--cl-ink-3)]">
      {t('proposal.material.notReviewed')}
    </p>
  );
}
