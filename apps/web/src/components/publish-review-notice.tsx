import { useCallback } from 'react';

import { useRenderApi } from '../api/render-api-context';
import { findingsOfSeverity } from '../api/review-format';
import { useAsyncResource } from '../hooks/use-async-resource';
import { useT } from '../i18n/language-context';
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
      <p data-testid="youtube-review-warn" role="note" className="text-xs text-amber-300">
        {t('youtube.publish.review.warn')}
      </p>
    );
  }

  const criticals = report.data === null ? [] : findingsOfSeverity(report.data, 'critical');

  return (
    <div
      data-testid="youtube-review-fail"
      role="alert"
      className="space-y-2 rounded-md border border-rose-500/40 bg-rose-500/10 p-3"
    >
      <p className="text-sm text-rose-200">{t('youtube.publish.review.fail')}</p>
      {criticals.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-xs text-rose-100">
          {criticals.map((finding) => (
            <li key={finding.id}>{finding.message}</li>
          ))}
        </ul>
      )}
      <label className="flex items-center gap-2 text-sm text-slate-200">
        <input
          type="checkbox"
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
