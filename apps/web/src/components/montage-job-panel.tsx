import { useEffect, useRef } from 'react';

import { showsAssetProgress } from '../api/parse-render-job';
import { useRenderApi } from '../api/render-api-context';
import { useRenderJobPoll } from '../hooks/use-render-job-poll';
import { ErrorNotice } from './error-notice';

export type MontageJobPanelProps = {
  jobId: string | null;
  onSucceeded: () => void;
};

export function MontageJobPanel({ jobId, onSucceeded }: MontageJobPanelProps) {
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
        {poll.error.code}: this montage job may have been lost when the render service restarted.
      </p>
    );
  }

  if (job === null) {
    return poll.error !== null ? (
      <ErrorNotice error={poll.error} />
    ) : (
      <p className="text-sm text-slate-400">Loading montage job…</p>
    );
  }

  return (
    <div
      data-testid="montage-job-panel"
      data-montage-state={job.state}
      className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/40 p-4"
    >
      <p className="font-mono text-sm text-slate-100">{job.id}</p>
      <p className="text-sm text-slate-300">state: {job.state}</p>

      {job.progress !== null && (
        <p data-testid="montage-stage" className="text-sm text-slate-400">
          stage: {job.progress.stage}
        </p>
      )}

      {job.kind === 'montage' && showsAssetProgress(job.progress) && (
        <p data-testid="montage-asset-progress" className="font-mono text-xs text-slate-400">
          {job.progress.processedAssets ?? '—'}/{job.progress.totalAssets ?? '—'} assets (
          {job.progress.percent ?? '—'}%)
        </p>
      )}

      {job.kind === 'montage' && job.state === 'succeeded' && job.report !== null && (
        <p className="font-mono text-xs text-emerald-200">
          {job.report.timelinePath} · preset {job.report.preset} · seed {job.report.seed}
        </p>
      )}

      {job.state === 'failed' && job.error !== null && (
        <p role="alert" className="font-mono text-sm text-rose-300">
          {job.error.code}: {job.error.message}
        </p>
      )}
    </div>
  );
}
