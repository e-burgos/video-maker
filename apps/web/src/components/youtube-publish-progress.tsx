import { useEffect, useRef } from 'react';

import { isTerminalRenderJobState } from '../api/parse-render-job';
import { useRenderApi } from '../api/render-api-context';
import { RenderApiError } from '../api/render-api-error';
import { useApiAction } from '../hooks/use-api-action';
import { useRenderJobPoll } from '../hooks/use-render-job-poll';
import { useLanguage, useT } from '../i18n/language-context';
import { formatDateTime } from '../api/format-updated-at';
import { ErrorNotice } from './error-notice';
import { JobRetryButton } from './job-retry-button';
import type { Job } from '../api/render-api-types';
import type { PublishJob } from '../api/youtube-types';

export type YouTubePublishProgressProps = {
  jobId: string;
  onRetried: (job: Job) => void;
  onSucceeded: () => void;
};

function ProgressBar({ percent }: { percent: number | null }) {
  const t = useT();

  return (
    <div className="space-y-1">
      <div
        role="progressbar"
        aria-label={t('youtube.publish.progress')}
        aria-valuemin={0}
        aria-valuemax={100}
        {...(percent === null ? {} : { 'aria-valuenow': percent })}
        className="h-2 w-full overflow-hidden rounded-full bg-slate-800"
      >
        <div
          className="h-full bg-sky-400 transition-[width]"
          style={{ width: `${percent ?? 0}%` }}
        />
      </div>
      {percent !== null && (
        <p data-testid="youtube-publish-percent" className="font-mono text-xs text-slate-400">
          {percent}%
        </p>
      )}
    </div>
  );
}

function SuccessSummary({ job }: { job: PublishJob }) {
  const t = useT();
  const { language } = useLanguage();
  const report = job.report;

  if (report === null) {
    return null;
  }

  const scheduledFor = report.publishAt === null ? null : Date.parse(report.publishAt);

  return (
    <div data-testid="youtube-publish-success" className="space-y-2">
      <p className="text-sm text-emerald-300">
        {scheduledFor === null || Number.isNaN(scheduledFor)
          ? t('youtube.publish.succeeded')
          : t('youtube.publish.succeededScheduled', { date: formatDateTime(scheduledFor, language) })}
      </p>
      <p className="break-all font-mono text-xs text-slate-300">{report.url}</p>
      <a
        href={report.url}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-block rounded-md border border-emerald-500/50 px-3 py-1.5 text-sm text-emerald-100 hover:bg-emerald-500/10"
      >
        {t('youtube.publish.openOnYouTube')}
      </a>
    </div>
  );
}

export function YouTubePublishProgress({ jobId, onRetried, onSucceeded }: YouTubePublishProgressProps) {
  const client = useRenderApi();
  const t = useT();
  const poll = useRenderJobPoll(jobId, (id) => client.getRenderJob(id));
  const cancel = useApiAction((id: string) => client.cancelRenderJob(id));
  const notifiedRef = useRef<string | null>(null);
  const job = poll.job;

  useEffect(() => {
    if (job !== null && job.state === 'succeeded' && notifiedRef.current !== job.id) {
      notifiedRef.current = job.id;
      onSucceeded();
    }
  }, [job, onSucceeded]);

  if (job === null) {
    return poll.error !== null ? (
      <ErrorNotice error={poll.error} />
    ) : (
      <p role="status" className="text-sm text-slate-400">
        {t('youtube.publish.starting')}
      </p>
    );
  }

  const running = !isTerminalRenderJobState(job.state);
  const percent = job.kind === 'publish' && job.progress !== null ? job.progress.percent : null;
  const failure =
    job.state === 'failed' && job.error !== null
      ? new RenderApiError(job.error.code, job.error.message, null, job.error)
      : null;

  return (
    <div data-testid="youtube-publish-job" data-job-state={job.state} className="space-y-3">
      {running && (
        <div role="status" className="space-y-2">
          <p className="text-sm text-slate-300">
            {job.state === 'canceling' ? t('youtube.publish.canceling') : t('youtube.publish.uploading')}
          </p>
          <ProgressBar percent={percent} />
          <button
            type="button"
            disabled={job.state === 'canceling' || cancel.status === 'pending'}
            onClick={() => void cancel.run(job.id)}
            className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:border-slate-500 disabled:opacity-40"
          >
            {t('youtube.publish.cancelUpload')}
          </button>
        </div>
      )}

      {job.state === 'succeeded' && job.kind === 'publish' && <SuccessSummary job={job} />}

      {job.state === 'canceled' && <p className="text-sm text-amber-300">{t('youtube.publish.canceled')}</p>}

      {failure !== null && <ErrorNotice error={failure} />}

      <JobRetryButton job={job} onRetried={onRetried} />

      {cancel.error !== null && <ErrorNotice error={cancel.error} />}
      {poll.error !== null && <ErrorNotice error={poll.error} />}
    </div>
  );
}
