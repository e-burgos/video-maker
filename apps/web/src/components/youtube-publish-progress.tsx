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
import { SECONDARY_BUTTON_SMALL_CLASS } from './ui/cl-controls';
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
    <div className="flex flex-col gap-1">
      <div
        role="progressbar"
        aria-label={t('youtube.publish.progress')}
        aria-valuemin={0}
        aria-valuemax={100}
        {...(percent === null ? {} : { 'aria-valuenow': percent })}
        className="h-2 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--cl-ink)_14%,transparent)]"
      >
        <div
          className="h-full bg-[var(--cl-action-fill)] transition-[width]"
          style={{ width: `${percent ?? 0}%` }}
        />
      </div>
      {percent !== null && (
        <p data-testid="youtube-publish-percent" className="font-data m-0 text-xs text-[var(--cl-ink-2)]">
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
    <div data-testid="youtube-publish-success" className="flex flex-col gap-2">
      <p className="m-0 text-sm text-[var(--tucu-state-green-ink)]">
        {scheduledFor === null || Number.isNaN(scheduledFor)
          ? t('youtube.publish.succeeded')
          : t('youtube.publish.succeededScheduled', { date: formatDateTime(scheduledFor, language) })}
      </p>
      <p className="font-data m-0 break-all text-xs text-[var(--cl-ink-2)]">{report.url}</p>
      <a
        href={report.url}
        target="_blank"
        rel="noreferrer noopener"
        className={SECONDARY_BUTTON_SMALL_CLASS}
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
      <p role="status" className="m-0 text-sm text-[var(--cl-ink-2)]">
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
    <div data-testid="youtube-publish-job" data-job-state={job.state} className="flex flex-col gap-3">
      {running && (
        <div role="status" className="flex flex-col gap-2">
          <p className="m-0 text-sm text-[var(--cl-ink)]">
            {job.state === 'canceling' ? t('youtube.publish.canceling') : t('youtube.publish.uploading')}
          </p>
          <ProgressBar percent={percent} />
          <button
            type="button"
            disabled={job.state === 'canceling' || cancel.status === 'pending'}
            onClick={() => void cancel.run(job.id)}
            className={SECONDARY_BUTTON_SMALL_CLASS}
          >
            {t('youtube.publish.cancelUpload')}
          </button>
        </div>
      )}

      {job.state === 'succeeded' && job.kind === 'publish' && <SuccessSummary job={job} />}

      {job.state === 'canceled' && <p className="m-0 text-sm text-[var(--tucu-state-orange-ink)]">{t('youtube.publish.canceled')}</p>}

      {failure !== null && <ErrorNotice error={failure} />}

      <JobRetryButton job={job} onRetried={onRetried} />

      {cancel.error !== null && <ErrorNotice error={cancel.error} />}
      {poll.error !== null && <ErrorNotice error={poll.error} />}
    </div>
  );
}
