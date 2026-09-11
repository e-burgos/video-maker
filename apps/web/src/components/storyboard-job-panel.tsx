import { useEffect, useRef } from 'react';

import { useRenderApi } from '../api/render-api-context';
import { storyboardFailureKey } from '../api/storyboard-capability';
import { useRenderJobPoll } from '../hooks/use-render-job-poll';
import { useT } from '../i18n/language-context';
import type { TranslationKey } from '../i18n/messages-en';
import { ErrorNotice } from './error-notice';

const STAGE_KEYS: Readonly<Record<string, TranslationKey>> = {
  collect: 'storyboardJob.stage.collect',
  propose: 'storyboardJob.stage.propose',
  persist: 'storyboardJob.stage.persist',
};

export type StoryboardJobPanelProps = {
  jobId: string | null;
  onSucceeded: () => void;
};

export function StoryboardJobPanel({ jobId, onSucceeded }: StoryboardJobPanelProps) {
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
        {t('storyboardJob.lost', { code: poll.error.code })}
      </p>
    );
  }

  if (job === null) {
    return poll.error !== null ? (
      <ErrorNotice error={poll.error} />
    ) : (
      <p className="text-sm text-slate-400">{t('storyboardJob.loading')}</p>
    );
  }

  const explanationKey = job.error === null ? null : storyboardFailureKey(job.error.code);
  const stageKey = job.progress === null ? null : (STAGE_KEYS[job.progress.stage] ?? null);

  return (
    <div
      data-testid="storyboard-job-panel"
      data-storyboard-state={job.state}
      className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/40 p-4"
    >
      <p className="font-mono text-sm text-slate-100">{job.id}</p>
      <p className="text-sm text-slate-300">{t('job.state', { state: job.state })}</p>

      {job.progress !== null && (
        <>
          <p data-testid="storyboard-stage" className="text-sm text-slate-400">
            {t('job.stage', { stage: job.progress.stage })}
          </p>
          <p className="text-sm text-slate-400">{stageKey === null ? '' : t(stageKey)}</p>
        </>
      )}

      {job.kind === 'storyboard' && job.state === 'succeeded' && job.report !== null && (
        <p className="font-mono text-xs text-emerald-200">
          {t('storyboardJob.report', {
            path: job.report.storyboardPath,
            scenes: job.report.sceneCount,
            language: job.report.language,
            source: job.report.source,
          })}
        </p>
      )}

      {job.state === 'failed' && job.error !== null && (
        <div className="space-y-1">
          <p role="alert" className="font-mono text-sm text-rose-300">
            {t('job.failed', { code: job.error.code, message: job.error.message })}
          </p>
          {explanationKey !== null && (
            <p data-testid="storyboard-failure-explanation" className="text-sm text-amber-100">
              {t(explanationKey)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
