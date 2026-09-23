import { useEffect, useRef } from 'react';

import { showsAssetProgress } from '../api/parse-render-job';
import { useRenderApi } from '../api/render-api-context';
import { useRenderJobPoll } from '../hooks/use-render-job-poll';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';
import { JobRetryButton } from './job-retry-button';
import type { Job } from '../api/render-api-types';

export type MontageJobPanelProps = {
  jobId: string | null;
  onSucceeded: () => void;
  onRetried: (job: Job) => void;
};

export function MontageJobPanel({ jobId, onSucceeded, onRetried }: MontageJobPanelProps) {
  const client = useRenderApi();
  const poll = useRenderJobPoll(jobId, (id) => client.getRenderJob(id));
  const t = useT();
  const succeededJobRef = useRef<string | null>(null);
  const onSucceededRef = useRef(onSucceeded);

  onSucceededRef.current = onSucceeded;

  const job = poll.job;
  const succeededJobId = job !== null && job.state === 'succeeded' ? job.id : null;

  useEffect(() => {
    if (succeededJobId === null || succeededJobRef.current === succeededJobId) {
      return;
    }

    succeededJobRef.current = succeededJobId;
    onSucceededRef.current();
  }, [succeededJobId]);

  if (jobId === null) {
    return null;
  }

  if (poll.stopReason === 'not-found' && poll.error !== null) {
    return (
      <p role="alert" className="text-sm text-rose-300">
        {t('montageJob.lost', { code: poll.error.code })}
      </p>
    );
  }

  if (job === null) {
    return poll.error !== null ? (
      <ErrorNotice error={poll.error} />
    ) : (
      <p className="text-sm text-slate-400">{t('montageJob.loading')}</p>
    );
  }

  return (
    <div
      data-testid="montage-job-panel"
      data-montage-state={job.state}
      className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/40 p-4"
    >
      <p className="font-mono text-sm text-slate-100">{job.id}</p>
      <p className="text-sm text-slate-300">{t('job.state', { state: job.state })}</p>

      {job.progress !== null && (
        <p data-testid="montage-stage" className="text-sm text-slate-400">
          {t('job.stage', { stage: job.progress.stage })}
        </p>
      )}

      {job.kind === 'montage' && showsAssetProgress(job.progress) && (
        <p data-testid="montage-asset-progress" className="font-mono text-xs text-slate-400">
          {t('montageJob.assets', {
            processed: job.progress.processedAssets ?? '—',
            total: job.progress.totalAssets ?? '—',
            percent: job.progress.percent ?? '—',
          })}
        </p>
      )}

      {job.kind === 'montage' && job.state === 'succeeded' && job.report !== null && (
        <p className="font-mono text-xs text-emerald-200">
          {t('montageJob.report', {
            path: job.report.timelinePath,
            preset: job.report.preset,
            seed: job.report.seed,
          })}
        </p>
      )}

      {job.state === 'failed' && job.error !== null && job.error.code === 'JOB_INTERRUPTED' && (
        <p
          role="status"
          data-testid="job-interrupted-badge"
          className="inline-block rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-200"
        >
          {t('job.interrupted')}
        </p>
      )}

      {job.state === 'failed' && job.error !== null && job.error.code !== 'JOB_INTERRUPTED' && (
        <p role="alert" className="font-mono text-sm text-rose-300">
          {t('job.failed', { code: job.error.code, message: job.error.message })}
        </p>
      )}

      <JobRetryButton job={job} onRetried={onRetried} />
    </div>
  );
}
