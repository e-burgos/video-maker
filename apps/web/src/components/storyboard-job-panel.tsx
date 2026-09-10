import { useEffect, useRef } from 'react';

import { useRenderApi } from '../api/render-api-context';
import { storyboardFailureExplanation } from '../api/storyboard-capability';
import { useRenderJobPoll } from '../hooks/use-render-job-poll';
import { ErrorNotice } from './error-notice';

const STAGE_LABELS: Readonly<Record<string, string>> = {
  collect: 'Reading the project: catalog, transcript and previous storyboard.',
  propose: 'Asking the local AI agent for the storyboard. This takes more than a minute.',
  persist: 'Writing work/storyboard.json.',
};

export type StoryboardJobPanelProps = {
  jobId: string | null;
  onSucceeded: () => void;
};

export function StoryboardJobPanel({ jobId, onSucceeded }: StoryboardJobPanelProps) {
  const client = useRenderApi();
  const poll = useRenderJobPoll(jobId, (id) => client.getRenderJob(id));
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
        {poll.error.code}: this storyboard job may have been lost when the render service restarted.
      </p>
    );
  }

  if (job === null) {
    return poll.error !== null ? (
      <ErrorNotice error={poll.error} />
    ) : (
      <p className="text-sm text-slate-400">Loading storyboard job…</p>
    );
  }

  const explanation =
    job.error === null ? null : storyboardFailureExplanation(job.error.code);

  return (
    <div
      data-testid="storyboard-job-panel"
      data-storyboard-state={job.state}
      className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/40 p-4"
    >
      <p className="font-mono text-sm text-slate-100">{job.id}</p>
      <p className="text-sm text-slate-300">state: {job.state}</p>

      {job.progress !== null && (
        <>
          <p data-testid="storyboard-stage" className="text-sm text-slate-400">
            stage: {job.progress.stage}
          </p>
          <p className="text-sm text-slate-400">{STAGE_LABELS[job.progress.stage]}</p>
        </>
      )}

      {job.kind === 'storyboard' && job.state === 'succeeded' && job.report !== null && (
        <p className="font-mono text-xs text-emerald-200">
          {job.report.storyboardPath} · {job.report.sceneCount} scenes · {job.report.language} ·
          from {job.report.source}
        </p>
      )}

      {job.state === 'failed' && job.error !== null && (
        <div className="space-y-1">
          <p role="alert" className="font-mono text-sm text-rose-300">
            {job.error.code}: {job.error.message}
          </p>
          {explanation !== null && (
            <p data-testid="storyboard-failure-explanation" className="text-sm text-amber-100">
              {explanation}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
