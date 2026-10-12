import { canonicalMaterialPath, hasMaterialWarnings } from '@video-maker/timeline-core';
import type { MaterialReview, MaterialReviewItem, MaterialVerdict, MaterialWarnings } from '@video-maker/timeline-core';

import { artifactUrl } from '../api/artifact-url';
import { useT } from '../i18n/language-context';
import type { TranslationKey } from '../i18n/messages-en';
import { Badge } from './ui/badge';
import type { BadgeTone } from './ui/badge';

const VERDICT_TONE: Readonly<Record<MaterialVerdict, BadgeTone>> = {
  fits: 'success',
  doubtful: 'warning',
  unfit: 'danger',
};

const BRAND_PREFIX = 'brand:';

function VerdictChip({ verdict }: { verdict: MaterialVerdict }) {
  const t = useT();

  return (
    <Badge tone={VERDICT_TONE[verdict]} data-verdict={verdict}>
      {t(`proposal.material.${verdict}` as TranslationKey)}
    </Badge>
  );
}

function MaterialThumb({ slug, item }: { slug: string; item: MaterialReviewItem }) {
  const t = useT();

  if (item.source === 'brand') {
    return (
      <span className="rounded-control border border-border-subtle px-2 py-1 font-mono text-[11px] text-ink-muted">
        {t('proposal.material.brandImage', { key: item.file.slice(BRAND_PREFIX.length) })}
      </span>
    );
  }

  return (
    <img
      src={artifactUrl(slug, canonicalMaterialPath(item.file))}
      alt={item.file}
      loading="lazy"
      className="h-16 w-24 shrink-0 rounded-control border border-border-subtle object-cover"
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
      className="space-y-3 rounded-panel border border-warning/60 bg-warning/10 p-3"
    >
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-warning">{t('proposal.material.heading')}</h3>
        <p className="text-xs text-ink-muted">{t('proposal.material.intro')}</p>
      </div>
      {warnings.items.length > 0 && (
        <ul className="space-y-2">
          {warnings.items.map((item) => (
            <li key={item.file} data-testid="material-warning-item" data-verdict={item.verdict} className="flex gap-3">
              <MaterialThumb slug={slug} item={item} />
              <div className="min-w-0 space-y-0.5 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <VerdictChip verdict={item.verdict} />
                  <span className="break-all font-mono text-ink-faint">{item.file}</span>
                </div>
                <p className="text-ink">{t('proposal.material.shows', { shows: item.shows })}</p>
                <p className="text-ink-muted">{item.reason}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {warnings.gaps.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-medium text-ink">{t('proposal.material.gapsHeading')}</h4>
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-ink-muted">
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
    <details data-testid="material-review-table" className="rounded-panel border border-border-subtle p-2">
      <summary className="cursor-pointer text-xs text-ink-muted">
        {t('proposal.material.tableSummary', { count: review.items.length })}
      </summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-ink-faint">
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
                <td className="break-all py-1 pr-2 font-mono text-ink-faint">{item.file}</td>
                <td className="py-1 pr-2 text-ink">{item.shows}</td>
                <td className="py-1 pr-2">
                  <VerdictChip verdict={item.verdict} />
                </td>
                <td className="py-1 text-ink-muted">{item.useFor ?? ''}</td>
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
    <p data-testid="material-not-reviewed" className="text-xs text-ink-faint">
      {t('proposal.material.notReviewed')}
    </p>
  );
}
