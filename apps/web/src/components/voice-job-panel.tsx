import { useEffect, useRef } from 'react';

import { showsSceneProgress } from '../api/parse-render-job';
import { useRenderApi } from '../api/render-api-context';
import { voiceFailureKey } from '../api/voice-capability';
import { useRenderJobPoll } from '../hooks/use-render-job-poll';
import { useT } from '../i18n/language-context';
import type { TranslationKey } from '../i18n/messages-en';
import { ErrorNotice } from './error-notice';
import { JobRetryButton } from './job-retry-button';
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
      <p role="alert" className="text-sm text-rose-300">
        {t('voiceJob.lost', { code: poll.error.code })}
      </p>
    );
  }

  if (job === null) {
    return poll.error !== null ? (
      <ErrorNotice error={poll.error} />
    ) : (
      <p className="text-sm text-slate-400">{t('voiceJob.loading')}</p>
    );
  }

  const explanationKey = job.error === null ? null : voiceFailureKey(job.error.code);
  const progress = job.kind === 'voice' ? job.progress : null;
  const stageKey = progress === null ? null : (STAGE_KEYS[progress.stage] ?? null);

  return (
    <div
      data-testid="voice-job-panel"
      data-voice-state={job.state}
      className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/40 p-4"
    >
      <p className="font-mono text-sm text-slate-100">{job.id}</p>
      <p className="text-sm text-slate-300">{t('job.state', { state: job.state })}</p>

      {progress !== null && (
        <>
          <p data-testid="voice-stage" className="text-sm text-slate-400">
            {t('job.stage', { stage: progress.stage })}
          </p>
          <p className="text-sm text-slate-400">{stageKey === null ? '' : t(stageKey)}</p>
          {showsSceneProgress(progress) && (
            <p data-testid="voice-scene-progress" className="font-mono text-xs text-slate-300">
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
        <p className="font-mono text-xs text-emerald-200">
          {job.report.manifestPath} ·{' '}
          {job.report.track === null
            ? `${job.report.scenes.length} tracks`
            : `${job.report.track.path} · ${job.report.track.lineCount} lines`}{' '}
          · {job.report.voiceId} · {job.report.language}
        </p>
      )}

      {job.state === 'failed' && job.error !== null && (
        <div className="space-y-1">
          {job.error.code === 'JOB_INTERRUPTED' ? (
            <p
              role="status"
              data-testid="job-interrupted-badge"
              className="inline-block rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-200"
            >
              {t('job.interrupted')}
            </p>
          ) : (
            <p role="alert" className="font-mono text-sm text-rose-300">
              {t('job.failed', { code: job.error.code, message: job.error.message })}
            </p>
          )}
          {explanationKey !== null && (
            <p data-testid="voice-failure-explanation" className="text-sm text-amber-100">
              {t(explanationKey)}
            </p>
          )}
        </div>
      )}

      <JobRetryButton job={job} onRetried={onRetried} />
    </div>
  );
}
