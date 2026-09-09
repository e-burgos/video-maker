import { isTerminalRenderJobState } from './parse-render-job';
import type { RenderApiError } from './render-api-error';
import type { RenderJob } from './render-api-types';

export const RENDER_JOB_POLL_INTERVAL_MS = 1000;
export const RENDER_JOB_POLL_TRANSPORT_RETRY_LIMIT = 3;

export type PollOutcome = { kind: 'job'; job: RenderJob } | { kind: 'error'; error: RenderApiError };

export type PollStopReason = 'terminal' | 'not-found' | 'unreachable';

export type PollPlan = { keepPolling: true } | { keepPolling: false; reason: PollStopReason };

export function nextPollPlan(outcome: PollOutcome, consecutiveTransportFailures: number): PollPlan {
  if (outcome.kind === 'job') {
    if (isTerminalRenderJobState(outcome.job.state)) {
      return { keepPolling: false, reason: 'terminal' };
    }

    return { keepPolling: true };
  }

  if (outcome.error.code === 'RENDER_JOB_NOT_FOUND') {
    return { keepPolling: false, reason: 'not-found' };
  }

  if (outcome.error.code === 'SERVICE_UNREACHABLE') {
    if (consecutiveTransportFailures + 1 < RENDER_JOB_POLL_TRANSPORT_RETRY_LIMIT) {
      return { keepPolling: true };
    }

    return { keepPolling: false, reason: 'unreachable' };
  }

  return { keepPolling: false, reason: 'unreachable' };
}
