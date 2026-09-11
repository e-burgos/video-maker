import { useEffect, useRef } from 'react';

import { showsSceneProgress } from '../api/parse-render-job';
import { useRenderApi } from '../api/render-api-context';
import { voiceFailureExplanation } from '../api/voice-capability';
import { useRenderJobPoll } from '../hooks/use-render-job-poll';
import { ErrorNotice } from './error-notice';

const STAGE_LABELS: Readonly<Record<string, string>> = {
  synthesize: 'Piper is reading the narration of every scene.',
  transcribe: 'Whisper is aligning every track word by word.',
  persist: 'Writing work/voice/manifest.json with the measured durations.',
};

export type VoiceJobPanelProps = {
  jobId: string | null;
  onSucceeded: () => void;
};

export function VoiceJobPanel({ jobId, onSucceeded }: VoiceJobPanelProps) {
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
        {poll.error.code}: this voice job may have been lost when the render service restarted.
      </p>
    );
  }

  if (job === null) {
    return poll.error !== null ? (
      <ErrorNotice error={poll.error} />
    ) : (
      <p className="text-sm text-slate-400">Loading voice job…</p>
    );
  }

  const explanation = job.error === null ? null : voiceFailureExplanation(job.error.code);
  const progress = job.kind === 'voice' ? job.progress : null;

  return (
    <div
      data-testid="voice-job-panel"
      data-voice-state={job.state}
      className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/40 p-4"
    >
      <p className="font-mono text-sm text-slate-100">{job.id}</p>
      <p className="text-sm text-slate-300">state: {job.state}</p>

      {progress !== null && (
        <>
          <p data-testid="voice-stage" className="text-sm text-slate-400">
            stage: {progress.stage}
          </p>
          <p className="text-sm text-slate-400">{STAGE_LABELS[progress.stage]}</p>
          {showsSceneProgress(progress) && (
            <p data-testid="voice-scene-progress" className="font-mono text-xs text-slate-300">
              scene {progress.processedScenes} of {progress.totalScenes}
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
          <p role="alert" className="font-mono text-sm text-rose-300">
            {job.error.code}: {job.error.message}
          </p>
          {explanation !== null && (
            <p data-testid="voice-failure-explanation" className="text-sm text-amber-100">
              {explanation}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
