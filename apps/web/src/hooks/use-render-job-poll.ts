import { useEffect, useRef, useState } from 'react';

import { RenderApiError, serviceUnreachable } from '../api/render-api-error';
import { RENDER_JOB_POLL_INTERVAL_MS, nextPollPlan } from '../api/render-job-poll-plan';
import type { PollStopReason } from '../api/render-job-poll-plan';
import type { RenderJob } from '../api/render-api-types';

export type RenderJobPoll = {
  job: RenderJob | null;
  error: RenderApiError | null;
  polling: boolean;
  stopReason: PollStopReason | null;
};

function toRenderApiError(cause: unknown): RenderApiError {
  return cause instanceof RenderApiError ? cause : serviceUnreachable(cause);
}

export function useRenderJobPoll(
  jobId: string | null,
  load: (jobId: string) => Promise<RenderJob>,
): RenderJobPoll {
  const [job, setJob] = useState<RenderJob | null>(null);
  const [error, setError] = useState<RenderApiError | null>(null);
  const [polling, setPolling] = useState(false);
  const [stopReason, setStopReason] = useState<PollStopReason | null>(null);

  const loadRef = useRef(load);
  const requestSequence = useRef(0);
  const consecutiveTransportFailuresRef = useRef(0);

  loadRef.current = load;

  useEffect(() => {
    requestSequence.current += 1;
    const sequence = requestSequence.current;
    consecutiveTransportFailuresRef.current = 0;

    setJob(null);
    setError(null);
    setStopReason(null);
    setPolling(jobId !== null);

    if (jobId === null) {
      return undefined;
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const tick = (currentJobId: string): void => {
      loadRef
        .current(currentJobId)
        .then((nextJob) => {
          if (sequence !== requestSequence.current) {
            return;
          }

          consecutiveTransportFailuresRef.current = 0;
          setJob(nextJob);
          setError(null);

          const plan = nextPollPlan({ kind: 'job', job: nextJob }, 0);
          if (plan.keepPolling) {
            timeoutId = setTimeout(() => tick(currentJobId), RENDER_JOB_POLL_INTERVAL_MS);
            return;
          }

          setPolling(false);
          setStopReason(plan.reason);
        })
        .catch((cause: unknown) => {
          if (sequence !== requestSequence.current) {
            return;
          }

          const typed = toRenderApiError(cause);
          const plan = nextPollPlan({ kind: 'error', error: typed }, consecutiveTransportFailuresRef.current);

          setError(typed);

          if (plan.keepPolling) {
            consecutiveTransportFailuresRef.current += 1;
            timeoutId = setTimeout(() => tick(currentJobId), RENDER_JOB_POLL_INTERVAL_MS);
            return;
          }

          setPolling(false);
          setStopReason(plan.reason);
        });
    };

    tick(jobId);

    return () => {
      requestSequence.current += 1;
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    };
  }, [jobId]);

  return { job, error, polling, stopReason };
}
