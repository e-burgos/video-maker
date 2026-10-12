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
import { Badge } from './ui/badge';
import { VisualReviewSection } from './visual-review-section';
import type { ReviewFinding, ReviewReport, ReviewSeverity } from '../api/review-types';

export type RenderReviewPanelProps = {
  slug: string;
  file: string;
};

const SEVERITY_TEXT_CLASS: Readonly<Record<ReviewSeverity, string>> = {
  critical: 'text-rose-300',
  suggestion: 'text-amber-300',
  nitpick: 'text-slate-400',
};

function FindingItem({ finding }: { finding: ReviewFinding }) {
  const t = useT();

  return (
    <li data-testid="review-finding" data-severity={finding.severity} className="space-y-0.5 text-sm">
      <p className="text-slate-200">
        {finding.message}
        {finding.timeRange !== undefined && (
          <span className="ml-2 font-mono text-xs text-slate-500">{formatFindingRange(finding.timeRange)}</span>
        )}
      </p>
      {finding.proposedFix !== undefined && (
        <p className="text-xs text-slate-400">
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
    <div data-testid={`review-group-${severity}`} className="space-y-1">
      <h4 className={`text-xs font-semibold uppercase tracking-wide ${SEVERITY_TEXT_CLASS[severity]}`}>
        {t(REVIEW_SEVERITY_LABEL[severity])} ({findings.length})
      </h4>
      <ul className="space-y-1.5">
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
    <dl className="grid gap-2 sm:grid-cols-3">
      {entries.map((entry) => (
        <div key={entry.testId} className="rounded-md border border-slate-800 px-2 py-1">
          <dt className="text-[11px] text-slate-500">{entry.label}</dt>
          <dd data-testid={entry.testId} className="font-mono text-sm text-slate-200">
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
    <div className="space-y-3">
      <p data-testid="review-counts" className="text-xs text-slate-400">
        {REVIEW_SEVERITY_ORDER.map((severity) =>
          t('review.count', { count: String(counts[severity]), severity: t(REVIEW_SEVERITY_LABEL[severity]) }),
        ).join(' · ')}
      </p>
      <KeyMetrics report={report} />
      <VisualReviewSection slug={slug} report={report} />
      {REVIEW_SEVERITY_ORDER.map((severity) => (
        <SeverityGroup key={severity} report={report} severity={severity} />
      ))}
      {report.findings.length === 0 && <p className="text-sm text-emerald-300">{t('review.noFindings')}</p>}
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
    <section data-testid="render-review" data-file={file} className="space-y-3 rounded-md border border-slate-800 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium text-slate-200">{t('review.heading')}</h3>
        {report.data !== null ? (
          <Badge data-testid="review-status" tone={REVIEW_STATUS_TONE[report.data.status]}>
            {t(REVIEW_STATUS_LABEL[report.data.status])}
          </Badge>
        ) : (
          report.status === 'ready' && <Badge data-testid="review-status">{t('review.status.none')}</Badge>
        )}
        <button
          type="button"
          data-testid="review-run"
          disabled={reviewing}
          onClick={() => void runReview()}
          className="ml-auto rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-slate-500 disabled:opacity-40"
        >
          {reviewing ? t('review.running') : report.data === null ? t('review.run') : t('review.rerun')}
        </button>
      </div>

      {report.status === 'loading' && <p className="text-xs text-slate-500">{t('review.loading')}</p>}
      {report.status === 'error' && report.error !== null && <ErrorNotice error={report.error} onRetry={report.reload} />}
      {start.error !== null && <ErrorNotice error={start.error} />}
      {failedJob !== null && failedJob.error !== null && (
        <p role="alert" className="text-xs text-rose-300">
          {failedJob.error.code}: {failedJob.error.message}
        </p>
      )}
      {report.data !== null && <ReportBody slug={slug} report={report.data} />}
    </section>
  );
}
