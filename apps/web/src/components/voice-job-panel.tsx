import { StateBadge } from '@e-burgos/tucu-ui';
import { useEffect, useRef } from 'react';

import { showsSceneProgress } from '../api/parse-render-job';
import { useRenderApi } from '../api/render-api-context';
import { voiceFailureKey } from '../api/voice-capability';
import { useRenderJobPoll } from '../hooks/use-render-job-poll';
import { useT } from '../i18n/language-context';
import type { TranslationKey } from '../i18n/messages-en';
import { ErrorNotice } from './error-notice';
import { JobRetryButton } from './job-retry-button';
import { ToolbarStatus } from './shell/toolbar-status';
import type { Job } from '../api/render-api-types';

const STAGE_KEYS: Readonly<Record<string, TranslationKey>> = {
  synthesize: 'voiceJob.stage.synthesize',
  transcribe: 'voiceJob.stage.transcribe',
  persist: 'voiceJob.stage.persist',
};

export type VoiceJobPanelProps = {
  jobId: string | null;
  onSucceeded: () => void;
  onRetried: (job: Job) => void;
};

export function VoiceJobPanel({ jobId, onSucceeded, onRetried }: VoiceJobPanelProps) {
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
      <p role="alert" className="m-0 text-sm text-[var(--tucu-state-red-ink)]">
        {t('voiceJob.lost', { code: poll.error.code })}
      </p>
    );
  }

  if (job === null) {
    return poll.error !== null ? (
      <ErrorNotice surface="glass" error={poll.error} />
    ) : (
      <p className="m-0 text-sm text-[var(--cl-ink-2)]">{t('voiceJob.loading')}</p>
    );
  }

  const explanationKey = job.error === null ? null : voiceFailureKey(job.error.code);
  const progress = job.kind === 'voice' ? job.progress : null;
  const stageKey = progress === null ? null : (STAGE_KEYS[progress.stage] ?? null);

  const inProgress = job.state === 'queued' || job.state === 'running';

  return (
    <>
      {inProgress && (
        <ToolbarStatus>
          <StateBadge tone="purple" dot size="sm" data-testid="voice-toolbar-status">
            {t('voiceJob.running')}
          </StateBadge>
        </ToolbarStatus>
      )}
    <div
      data-testid="voice-job-panel"
      data-voice-state={job.state}
      className="glass flex flex-col gap-2 rounded-[20px] p-4"
    >
      <p className="font-data m-0 text-sm font-semibold text-[var(--cl-ink)]">{job.id}</p>
      <p className="m-0 text-sm text-[var(--cl-ink-2)]">{t('job.state', { state: job.state })}</p>

      {progress !== null && (
        <>
          <p data-testid="voice-stage" className="m-0 text-sm text-[var(--cl-ink-2)]">
            {t('job.stage', { stage: progress.stage })}
          </p>
          <p className="m-0 text-sm text-[var(--cl-ink-2)]">{stageKey === null ? '' : t(stageKey)}</p>
          {showsSceneProgress(progress) && (
            <p data-testid="voice-scene-progress" className="font-data m-0 text-xs text-[var(--cl-ink)]">
              {t('voiceJob.sceneProgress', {
                processed: progress.processedScenes,
                total: progress.totalScenes,
              })}
              {progress.percent === null ? '' : ` · ${progress.percent}%`}
            </p>
          )}
        </>
      )}

      {job.kind === 'voice' && job.state === 'succeeded' && job.report !== null && (
        <p className="font-data m-0 text-xs text-[var(--tucu-state-green-ink)]">
          {job.report.manifestPath} ·{' '}
          {job.report.track === null
            ? `${job.report.scenes.length} tracks`
            : `${job.report.track.path} · ${job.report.track.lineCount} lines`}{' '}
          · {job.report.voiceId} · {job.report.language}
        </p>
      )}

      {job.state === 'failed' && job.error !== null && (
        <div className="flex flex-col gap-1">
          {job.error.code === 'JOB_INTERRUPTED' ? (
            <div role="status" data-testid="job-interrupted-badge">
              <StateBadge tone="orange" dot size="sm">
                {t('job.interrupted')}
              </StateBadge>
            </div>
          ) : (
            <p role="alert" className="font-data m-0 text-sm text-[var(--tucu-state-red-ink)]">
              {t('job.failed', { code: job.error.code, message: job.error.message })}
            </p>
          )}
          {explanationKey !== null && (
            <p data-testid="voice-failure-explanation" className="m-0 text-sm text-[var(--tucu-state-orange-ink)]">
              {t(explanationKey)}
            </p>
          )}
        </div>
      )}

      <JobRetryButton surface="glass" job={job} onRetried={onRetried} />
    </div>
    </>
  );
}
