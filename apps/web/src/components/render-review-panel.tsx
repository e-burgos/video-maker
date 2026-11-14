import { StateBadge } from '@e-burgos/tucu-ui';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useRenderApi } from '../api/render-api-context';
import {
  REVIEW_SEVERITY_LABEL,
  REVIEW_SEVERITY_ORDER,
  REVIEW_STATUS_LABEL,
  REVIEW_STATUS_TONE,
  findingsOfSeverity,
  formatFindingRange,
  formatMetric,
  reviewCounts,
} from '../api/review-format';
import { useApiAction } from '../hooks/use-api-action';
import { useAsyncResource } from '../hooks/use-async-resource';
import { useRenderJobPoll } from '../hooks/use-render-job-poll';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';
import { SECONDARY_BUTTON_SMALL_CLASS } from './ui/cl-controls';
import { VisualReviewSection } from './visual-review-section';
import type { ReviewFinding, ReviewReport, ReviewSeverity } from '../api/review-types';

export type RenderReviewPanelProps = {
  slug: string;
  file: string;
};

const SEVERITY_TEXT_CLASS: Readonly<Record<ReviewSeverity, string>> = {
  critical: 'text-[var(--tucu-state-red-ink)]',
  suggestion: 'text-[var(--tucu-state-orange-ink)]',
  nitpick: 'text-[var(--cl-ink-3)]',
};

function FindingItem({ finding }: { finding: ReviewFinding }) {
  const t = useT();

  return (
    <li data-testid="review-finding" data-severity={finding.severity} className="flex flex-col gap-0.5 text-sm">
      <p className="m-0 text-[var(--cl-ink)]">
        {finding.message}
        {finding.timeRange !== undefined && (
          <span className="font-data ml-2 text-xs text-[var(--cl-ink-3)]">{formatFindingRange(finding.timeRange)}</span>
        )}
      </p>
      {finding.proposedFix !== undefined && (
        <p className="m-0 text-xs text-[var(--cl-ink-2)]">
          {t('review.proposedFix')} {finding.proposedFix}
        </p>
      )}
    </li>
  );
}

function SeverityGroup({ report, severity }: { report: ReviewReport; severity: ReviewSeverity }) {
  const t = useT();
  const findings = findingsOfSeverity(report, severity);

  if (findings.length === 0) {
    return null;
  }

  return (
    <div data-testid={`review-group-${severity}`} className="flex flex-col gap-1">
      <h4 className={`m-0 text-xs font-semibold uppercase tracking-wide ${SEVERITY_TEXT_CLASS[severity]}`}>
        {t(REVIEW_SEVERITY_LABEL[severity])} ({findings.length})
      </h4>
      <ul className="m-0 list-none flex flex-col gap-1.5 p-0">
        {findings.map((finding) => (
          <FindingItem key={finding.id} finding={finding} />
        ))}
      </ul>
    </div>
  );
}

function KeyMetrics({ report }: { report: ReviewReport }) {
  const t = useT();
  const entries = [
    { testId: 'review-metric-lufs', label: t('review.metric.masterLufs'), value: formatMetric(report.metrics['masterIntegratedLufs'] ?? null, 'LUFS') },
    { testId: 'review-metric-peak', label: t('review.metric.truePeak'), value: formatMetric(report.metrics['masterTruePeakDbtp'] ?? null, 'dBTP') },
    { testId: 'review-metric-margin', label: t('review.metric.voiceMusicMargin'), value: formatMetric(report.metrics['voiceMusicMarginDb'] ?? null, 'dB') },
  ];

  return (
    <dl className="m-0 grid gap-2 sm:grid-cols-3">
      {entries.map((entry) => (
        <div key={entry.testId} className="rounded-[10px] border border-[var(--tucu-glass-sub-line)] px-2 py-1">
          <dt className="text-[11px] text-[var(--cl-ink-3)]">{entry.label}</dt>
          <dd data-testid={entry.testId} className="font-data m-0 text-sm text-[var(--cl-ink)]">
            {entry.value ?? t('review.metric.unavailable')}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ReportBody({ slug, report }: { slug: string; report: ReviewReport }) {
  const t = useT();
  const counts = reviewCounts(report);

  return (
    <div className="flex flex-col gap-3">
      <p data-testid="review-counts" className="m-0 text-xs text-[var(--cl-ink-2)]">
        {REVIEW_SEVERITY_ORDER.map((severity) =>
          t('review.count', { count: String(counts[severity]), severity: t(REVIEW_SEVERITY_LABEL[severity]) }),
        ).join(' · ')}
      </p>
      <KeyMetrics report={report} />
      <VisualReviewSection slug={slug} report={report} />
      {REVIEW_SEVERITY_ORDER.map((severity) => (
        <SeverityGroup key={severity} report={report} severity={severity} />
      ))}
      {report.findings.length === 0 && <p className="m-0 text-sm text-[var(--tucu-state-green-ink)]">{t('review.noFindings')}</p>}
    </div>
  );
}

export function RenderReviewPanel({ slug, file }: RenderReviewPanelProps) {
  const client = useRenderApi();
  const t = useT();
  const loadReport = useCallback(async () => client.getRenderReview(slug, file), [client, slug, file]);
  const report = useAsyncResource<ReviewReport | null>(loadReport, `review:${slug}:${file}`);
  const start = useApiAction(() => client.createReviewJob(slug, file));
  const [jobId, setJobId] = useState<string | null>(null);
  const poll = useRenderJobPoll(jobId, (id) => client.getRenderJob(id));
  const reloadedForRef = useRef<string | null>(null);

  const reloadReport = report.reload;
  useEffect(() => {
    if (poll.job !== null && poll.stopReason === 'terminal' && reloadedForRef.current !== poll.job.id) {
      reloadedForRef.current = poll.job.id;
      reloadReport();
    }
  }, [poll.job, poll.stopReason, reloadReport]);

  async function runReview(): Promise<void> {
    const job = await start.run();
    if (job !== null) {
      setJobId(job.id);
    }
  }

  const reviewing = start.status === 'pending' || poll.polling;
  const failedJob = poll.job !== null && poll.job.state === 'failed' ? poll.job : null;

  return (
    <section data-testid="render-review" data-file={file} className="glass-sub flex flex-col gap-3 rounded-[14px] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="m-0 text-sm font-bold text-[var(--cl-ink)]">{t('review.heading')}</h3>
        {report.data !== null ? (
          <StateBadge
            data-testid="review-status"
            tone={REVIEW_STATUS_TONE[report.data.status]}
            dot
            size="sm"
          >
            {t(REVIEW_STATUS_LABEL[report.data.status])}
          </StateBadge>
        ) : (
          report.status === 'ready' && (
            <StateBadge data-testid="review-status" tone="neutral" size="sm">
              {t('review.status.none')}
            </StateBadge>
          )
        )}
        <button
          type="button"
          data-testid="review-run"
          disabled={reviewing}
          onClick={() => void runReview()}
          className={`${SECONDARY_BUTTON_SMALL_CLASS} ml-auto`}
        >
          {reviewing ? t('review.running') : report.data === null ? t('review.run') : t('review.rerun')}
        </button>
      </div>

      {report.status === 'loading' && <p className="m-0 text-xs text-[var(--cl-ink-3)]">{t('review.loading')}</p>}
      {report.status === 'error' && report.error !== null && <ErrorNotice error={report.error} onRetry={report.reload} />}
      {start.error !== null && <ErrorNotice error={start.error} />}
      {failedJob !== null && failedJob.error !== null && (
        <p role="alert" className="m-0 text-xs text-[var(--tucu-state-red-ink)]">
          {failedJob.error.code}: {failedJob.error.message}
        </p>
      )}
      {report.data !== null && <ReportBody slug={slug} report={report.data} />}
    </section>
  );
}
