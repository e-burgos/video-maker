import {
  isTerminalRenderJobState,
  showsAssetProgress,
  showsFrameProgress,
} from '../api/parse-render-job';
import { useRenderApi } from '../api/render-api-context';
import { renderJobDeliverableUrl, renderJobSampleUrl } from '../api/render-job-artifact';
import { useApiAction } from '../hooks/use-api-action';
import { useRenderJobPoll } from '../hooks/use-render-job-poll';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';
import { JobRetryButton } from './job-retry-button';
import type { Job } from '../api/render-api-types';

export type RenderJobPanelProps = {
  slug: string;
  jobId: string | null;
  onRetried: (job: Job) => void;
};

export function RenderJobPanel({ slug, jobId, onRetried }: RenderJobPanelProps) {
  const client = useRenderApi();
  const poll = useRenderJobPoll(jobId, (id) => client.getRenderJob(id));
  const cancelAction = useApiAction((id: string) => client.cancelRenderJob(id));
  const t = useT();

  if (jobId === null) {
    return <p className="text-sm text-slate-400">{t('renderJob.none')}</p>;
  }

  if (poll.stopReason === 'not-found' && poll.error !== null) {
    return (
      <p role="alert" className="text-sm text-rose-300">
        {t('renderJob.lost', { code: poll.error.code })}
      </p>
    );
  }

  if (poll.job === null) {
    return poll.error !== null ? (
      <ErrorNotice error={poll.error} />
    ) : (
      <p className="text-sm text-slate-400">{t('renderJob.loading')}</p>
    );
  }

  const job = poll.job;
  const canCancel = !isTerminalRenderJobState(job.state);

  return (
    <div
      data-testid="render-job-panel"
      className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/40 p-4"
    >
      <p className="font-mono text-sm text-slate-100">{job.id}</p>
      <p className="text-sm text-slate-300">{t('job.state', { state: job.state })}</p>

      {job.progress !== null && (
        <p className="text-sm text-slate-400">{t('job.stage', { stage: job.progress.stage })}</p>
      )}

      {job.kind === 'render' && showsFrameProgress(job.progress) && (
        <p className="font-mono text-xs text-slate-400">
          {t('renderJob.frames', {
            rendered: job.progress.renderedFrames ?? '—',
            total: job.progress.totalFrames ?? '—',
            percent: job.progress.percent ?? '—',
          })}
        </p>
      )}

      {job.kind === 'montage' && showsAssetProgress(job.progress) && (
        <p className="font-mono text-xs text-slate-400">
          {t('montageJob.assets', {
            processed: job.progress.processedAssets ?? '—',
            total: job.progress.totalAssets ?? '—',
            percent: job.progress.percent ?? '—',
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

      {job.kind === 'render' && job.state === 'succeeded' && (
        <a
          href={
            job.report?.sample === true
              ? renderJobSampleUrl(slug, job.id)
              : renderJobDeliverableUrl(slug, job.id)
          }
          className="inline-block rounded-md border border-emerald-500/50 px-3 py-1 text-sm text-emerald-100"
        >
          {t('renderJob.download')}
        </a>
      )}

      {canCancel && (
        <button
          type="button"
          onClick={() => void cancelAction.run(job.id)}
          disabled={cancelAction.status === 'pending'}
          className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 disabled:opacity-40"
        >
          {t('renderJob.cancel')}
        </button>
      )}

      {cancelAction.error !== null && <ErrorNotice error={cancelAction.error} />}
    </div>
  );
}
