import { StateBadge } from '@e-burgos/tucu-ui';

import {
  isTerminalRenderJobState,
  showsAssetProgress,
  showsFrameProgress,
} from '../api/parse-render-job';
import { useRenderApi } from '../api/render-api-context';
import { renderJobDeliverableUrl, renderJobSampleUrl } from '../api/render-job-artifact';
import { INTERRUPTED_JOB_CODE, renderJobTone } from '../api/render-job-tone';
import { useApiAction } from '../hooks/use-api-action';
import { useRenderJobPoll } from '../hooks/use-render-job-poll';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';
import { JobRetryButton } from './job-retry-button';
import { ToolbarStatus } from './shell/toolbar-status';
import { SECONDARY_BUTTON_SMALL_CLASS } from './ui/cl-controls';
import type { Job } from '../api/render-api-types';

export type RenderJobPanelProps = {
  slug: string;
  jobId: string | null;
  onRetried: (job: Job) => void;
};

const MUTED_LINE = 'm-0 text-sm text-[var(--cl-ink-2)]';
const DATA_LINE = 'font-data m-0 text-xs text-[var(--cl-ink-2)]';

export function RenderJobPanel({ slug, jobId, onRetried }: RenderJobPanelProps) {
  const client = useRenderApi();
  const poll = useRenderJobPoll(jobId, (id) => client.getRenderJob(id));
  const cancelAction = useApiAction((id: string) => client.cancelRenderJob(id));
  const t = useT();

  if (jobId === null) {
    return <p className={MUTED_LINE}>{t('renderJob.none')}</p>;
  }

  if (poll.stopReason === 'not-found' && poll.error !== null) {
    return (
      <p role="alert" className="m-0 text-sm text-[var(--tucu-state-red-ink)]">
        {t('renderJob.lost', { code: poll.error.code })}
      </p>
    );
  }

  if (poll.job === null) {
    return poll.error !== null ? (
      <ErrorNotice error={poll.error} />
    ) : (
      <p className={MUTED_LINE}>{t('renderJob.loading')}</p>
    );
  }

  const job = poll.job;
  const canCancel = !isTerminalRenderJobState(job.state);
  const interrupted = job.state === 'failed' && job.error !== null && job.error.code === INTERRUPTED_JOB_CODE;

  return (
    <div
      data-testid="render-job-panel"
      data-job-state={job.state}
      className="glass-sub flex flex-col gap-2 rounded-[14px] p-3"
    >
      {canCancel && job.kind === 'render' && (
        <ToolbarStatus>
          <StateBadge tone="purple" dot size="sm" data-testid="render-toolbar-status">
            {t('renderJob.running')}
          </StateBadge>
        </ToolbarStatus>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <p className="font-data m-0 text-sm font-semibold text-[var(--cl-ink)]">{job.id}</p>
        <StateBadge tone={renderJobTone(job.state, job.error?.code ?? null)} dot size="sm">
          {job.state}
        </StateBadge>
      </div>
      <p className={MUTED_LINE}>{t('job.state', { state: job.state })}</p>

      {job.progress !== null && <p className={MUTED_LINE}>{t('job.stage', { stage: job.progress.stage })}</p>}

      {job.kind === 'render' && showsFrameProgress(job.progress) && (
        <p className={DATA_LINE}>
          {t('renderJob.frames', {
            rendered: job.progress.renderedFrames ?? '—',
            total: job.progress.totalFrames ?? '—',
            percent: job.progress.percent ?? '—',
          })}
        </p>
      )}

      {job.kind === 'montage' && showsAssetProgress(job.progress) && (
        <p className={DATA_LINE}>
          {t('montageJob.assets', {
            processed: job.progress.processedAssets ?? '—',
            total: job.progress.totalAssets ?? '—',
            percent: job.progress.percent ?? '—',
          })}
        </p>
      )}

      {interrupted && (
        <div role="status" data-testid="job-interrupted-badge">
          <StateBadge tone="orange" dot size="sm">
            {t('job.interrupted')}
          </StateBadge>
        </div>
      )}

      {job.state === 'failed' && job.error !== null && !interrupted && (
        <p role="alert" className="font-data m-0 text-sm text-[var(--tucu-state-red-ink)]">
          {t('job.failed', { code: job.error.code, message: job.error.message })}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <JobRetryButton job={job} onRetried={onRetried} />

        {job.kind === 'render' && job.state === 'succeeded' && (
          <a
            href={
              job.report?.sample === true
                ? renderJobSampleUrl(slug, job.id)
                : renderJobDeliverableUrl(slug, job.id)
            }
            className={`${SECONDARY_BUTTON_SMALL_CLASS} no-underline`}
          >
            {t('renderJob.download')}
          </a>
        )}

        {canCancel && (
          <button
            type="button"
            onClick={() => void cancelAction.run(job.id)}
            disabled={cancelAction.status === 'pending'}
            className={SECONDARY_BUTTON_SMALL_CLASS}
          >
            {t('renderJob.cancel')}
          </button>
        )}
      </div>

      {cancelAction.error !== null && <ErrorNotice error={cancelAction.error} />}
    </div>
  );
}
