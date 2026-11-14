import { useCallback } from 'react';

import { useRenderApi } from '../api/render-api-context';
import { findingsOfSeverity } from '../api/review-format';
import { useAsyncResource } from '../hooks/use-async-resource';
import { useT } from '../i18n/language-context';
import { CHECKBOX_CLASS, CHECK_LABEL_CLASS } from './ui/cl-controls';
import type { ReviewReport, ReviewStatus } from '../api/review-types';

export type PublishReviewNoticeProps = {
  slug: string;
  file: string;
  status: Exclude<ReviewStatus, 'pass'>;
  ignoreReview: boolean;
  disabled: boolean;
  onIgnoreReviewChange: (ignore: boolean) => void;
};

export function PublishReviewNotice({
  slug,
  file,
  status,
  ignoreReview,
  disabled,
  onIgnoreReviewChange,
}: PublishReviewNoticeProps) {
  const client = useRenderApi();
  const t = useT();
  const loadReport = useCallback(async () => client.getRenderReview(slug, file), [client, slug, file]);
  const report = useAsyncResource<ReviewReport | null>(loadReport, `publish-review:${slug}:${file}`);

  if (status === 'warn') {
    return (
      <p data-testid="youtube-review-warn" role="note" className="m-0 text-xs text-[var(--tucu-state-orange-ink)]">
        {t('youtube.publish.review.warn')}
      </p>
    );
  }

  const criticals = report.data === null ? [] : findingsOfSeverity(report.data, 'critical');

  return (
    <div
      data-testid="youtube-review-fail"
      role="alert"
      className="flex flex-col gap-2 rounded-[12px] border border-[var(--tucu-state-red-line)] bg-[var(--tucu-state-red-soft)] p-3"
    >
      <p className="m-0 text-sm text-[var(--tucu-state-red-ink)]">{t('youtube.publish.review.fail')}</p>
      {criticals.length > 0 && (
        <ul className="m-0 list-disc flex flex-col gap-1 pl-5 text-xs text-[var(--cl-ink)]">
          {criticals.map((finding) => (
            <li key={finding.id}>{finding.message}</li>
          ))}
        </ul>
      )}
      <label className={CHECK_LABEL_CLASS}>
        <input
          type="checkbox"
          className={CHECKBOX_CLASS}
          data-testid="youtube-ignore-review"
          checked={ignoreReview}
          disabled={disabled}
          onChange={(event) => onIgnoreReviewChange(event.target.checked)}
        />
        {t('youtube.publish.review.ignore')}
      </label>
    </div>
  );
}
