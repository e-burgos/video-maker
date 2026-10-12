import { useState } from 'react';

import { artifactUrl } from '../api/artifact-url';
import { isTerminalRenderJobState, showsFrameProgress } from '../api/parse-render-job';
import { SAMPLE_SECONDS } from '../api/proposal-types';
import { useRenderApi } from '../api/render-api-context';
import { renderJobSampleUrl } from '../api/render-job-artifact';
import type { Job } from '../api/render-api-types';
import { useApiAction } from '../hooks/use-api-action';
import { useRenderJobPoll } from '../hooks/use-render-job-poll';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';
import { JobRetryButton } from './job-retry-button';
import { MotionJobStatus } from './motion-job-status';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

export type SampleTriggerProps = {
  slug: string;
  kind: 'render' | 'motion';
  disabled?: boolean;
};

function sampleVideoUrl(slug: string, job: Job): string | null {
  if (job.kind === 'render') {
    return renderJobSampleUrl(slug, job.id);
  }
  if (job.kind === 'motion' && job.report?.path) {
    return artifactUrl(slug, job.report.path);
  }
  return null;
}

function RenderSampleStatus({ job, onRetried }: { job: Job; onRetried: (job: Job) => void }) {
  const t = useT();
  const running = !isTerminalRenderJobState(job.state);
  const progress = job.kind === 'render' ? job.progress : null;

  return (
    <div data-testid="sample-job-status" data-job-state={job.state} className="space-y-1">
      {running && (
        <p role="status" className="text-sm text-ink-muted">
          {t('sample.running')}
        </p>
      )}
      {running && progress !== null && showsFrameProgress(progress) && (
        <p className="font-mono text-xs text-ink-faint">
          {t('renderJob.frames', {
            rendered: progress.renderedFrames ?? '—',
            total: progress.totalFrames ?? '—',
            percent: progress.percent ?? '—',
          })}
        </p>
      )}
      {job.state === 'failed' && job.error !== null && (
        <p role="alert" className="font-mono text-sm text-danger">
          {t('sample.failed', { code: job.error.code, message: job.error.message })}
        </p>
      )}
      <JobRetryButton job={job} onRetried={onRetried} />
    </div>
  );
}

export function SampleTrigger({ slug, kind, disabled = false }: SampleTriggerProps) {
  const client = useRenderApi();
  const t = useT();
  const [jobId, setJobId] = useState<string | null>(null);
  const poll = useRenderJobPoll(jobId, (id) => client.getRenderJob(id));
  const createAction = useApiAction((): Promise<Job> => {
    const sample = { seconds: SAMPLE_SECONDS };
    return kind === 'render'
      ? client.createRenderJob(slug, { sample })
      : client.createMotionJob(slug, { phase: 'video', sample });
  });

  const job = poll.job;
  const busy = createAction.status === 'pending' || (jobId !== null && (poll.polling || job === null));
  const videoUrl = job !== null && job.state === 'succeeded' ? sampleVideoUrl(slug, job) : null;

  async function start() {
    const created = await createAction.run();
    if (created !== null) {
      setJobId(created.id);
    }
  }

  return (
    <div data-testid="sample-trigger" className="space-y-2">
      <Button disabled={disabled || busy} onClick={() => void start()}>
        {createAction.status === 'pending'
          ? t('sample.starting')
          : t('sample.start', { seconds: SAMPLE_SECONDS })}
      </Button>
      <p className="text-xs text-ink-faint">{t('sample.hint')}</p>

      {createAction.error !== null && <ErrorNotice error={createAction.error} />}
      {poll.error !== null && job === null && <ErrorNotice error={poll.error} />}

      {job !== null && job.kind === 'motion' && <MotionJobStatus job={job} onRetried={(next) => setJobId(next.id)} />}
      {job !== null && job.kind !== 'motion' && (
        <RenderSampleStatus job={job} onRetried={(next) => setJobId(next.id)} />
      )}

      {videoUrl !== null && (
        <div data-testid="sample-result" className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge tone="accent">{t('sample.badge')}</Badge>
            <span className="text-xs text-success">{t('sample.ready')}</span>
          </div>
          <video
            data-testid="sample-video"
            aria-label={t('sample.videoLabel')}
            src={videoUrl}
            controls
            preload="metadata"
            className="w-full max-w-3xl rounded-control bg-black"
          />
        </div>
      )}
    </div>
  );
}
