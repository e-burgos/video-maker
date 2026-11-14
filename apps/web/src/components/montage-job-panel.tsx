import { StateBadge } from '@e-burgos/tucu-ui';
import { useEffect, useRef } from 'react';

import { showsAssetProgress } from '../api/parse-render-job';
import { useRenderApi } from '../api/render-api-context';
import { useRenderJobPoll } from '../hooks/use-render-job-poll';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';
import { JobRetryButton } from './job-retry-button';
import { ToolbarStatus } from './shell/toolbar-status';
import type { Job } from '../api/render-api-types';

export type MontageJobPanelProps = {
  jobId: string | null;
  onSucceeded: () => void;
  onRetried: (job: Job) => void;
};

export function MontageJobPanel({
  jobId,
  onSucceeded,
  onRetried,
}: MontageJobPanelProps) {
  const client = useRenderApi();
  const poll = useRenderJobPoll(jobId, (id) => client.getRenderJob(id));
  const t = useT();
  const succeededJobRef = useRef<string | null>(null);
  const onSucceededRef = useRef(onSucceeded);

  onSucceededRef.current = onSucceeded;

  const job = poll.job;
  const succeededJobId =
    job !== null && job.state === 'succeeded' ? job.id : null;

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
      <p role="alert" className="m-0 text-sm text-[var(--tucu-state-red-ink)]">
        {t('montageJob.lost', { code: poll.error.code })}
      </p>
    );
  }

  if (job === null) {
    return poll.error !== null ? (
      <ErrorNotice error={poll.error} />
    ) : (
      <p className="m-0 text-sm text-[var(--cl-ink-2)]">
        {t('montageJob.loading')}
      </p>
    );
  }

  const inProgress = job.state === 'queued' || job.state === 'running';

  return (
    <>
      {inProgress && (
        <ToolbarStatus>
          <StateBadge
            tone="purple"
            dot
            size="sm"
            data-testid="montage-toolbar-status"
          >
            {t('library.montage.running')}
          </StateBadge>
        </ToolbarStatus>
      )}
      <div
        data-testid="montage-job-panel"
        data-montage-state={job.state}
        className="glass space-y-2 rounded-[20px] p-4"
      >
        <p className="font-data m-0 text-sm font-semibold text-[var(--cl-ink)]">
          {job.id}
        </p>
        <p className="m-0 text-sm text-[var(--cl-ink-2)]">
          {t('job.state', { state: job.state })}
        </p>

        {job.progress !== null && (
          <p
            data-testid="montage-stage"
            className="m-0 text-sm text-[var(--cl-ink-2)]"
          >
            {t('job.stage', { stage: job.progress.stage })}
          </p>
        )}

        {job.kind === 'montage' && showsAssetProgress(job.progress) && (
          <p
            data-testid="montage-asset-progress"
            className="font-data m-0 text-xs text-[var(--cl-ink-2)]"
          >
            {t('montageJob.assets', {
              processed: job.progress.processedAssets ?? '—',
              total: job.progress.totalAssets ?? '—',
              percent: job.progress.percent ?? '—',
            })}
          </p>
        )}

        {job.kind === 'montage' &&
          job.state === 'succeeded' &&
          job.report !== null && (
            <p className="font-data m-0 text-xs text-[var(--tucu-state-green-ink)]">
              {t('montageJob.report', {
                path: job.report.timelinePath,
                preset: job.report.preset,
                seed: job.report.seed,
              })}
            </p>
          )}

        {job.state === 'failed' &&
          job.error !== null &&
          job.error.code === 'JOB_INTERRUPTED' && (
            <div role="status" data-testid="job-interrupted-badge">
              <StateBadge tone="orange" dot size="sm">
                {t('job.interrupted')}
              </StateBadge>
            </div>
          )}

        {job.state === 'failed' &&
          job.error !== null &&
          job.error.code !== 'JOB_INTERRUPTED' && (
            <p
              role="alert"
              className="font-data m-0 text-sm text-[var(--tucu-state-red-ink)]"
            >
              {t('job.failed', {
                code: job.error.code,
                message: job.error.message,
              })}
            </p>
          )}

        <JobRetryButton job={job} onRetried={onRetried} />
      </div>
    </>
  );
}
