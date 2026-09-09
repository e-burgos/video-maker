import { describe, expect, it } from 'vitest';

import {
  RENDER_JOB_POLL_TRANSPORT_RETRY_LIMIT,
  nextPollPlan,
} from './render-job-poll-plan';
import { RenderApiError } from './render-api-error';
import type { RenderJob, RenderJobState } from './render-api-types';

function jobWithState(state: RenderJobState): RenderJob {
  return {
    id: 'job-0001',
    slug: 'smoke-ingest',
    state,
    createdAt: '2026-09-09T10:00:00.000Z',
    startedAt: '2026-09-09T10:00:01.000Z',
    finishedAt: null,
    progress: null,
    report: null,
    error: null,
  };
}

describe('nextPollPlan', () => {
  it.each<RenderJobState>(['succeeded', 'failed', 'canceled'])(
    'stops as terminal when the job reaches %s',
    (state) => {
      expect(nextPollPlan({ kind: 'job', job: jobWithState(state) }, 0)).toEqual({
        keepPolling: false,
        reason: 'terminal',
      });
    },
  );

  it.each<RenderJobState>(['queued', 'running', 'canceling'])(
    'keeps polling while the job is %s, canceling included',
    (state) => {
      expect(nextPollPlan({ kind: 'job', job: jobWithState(state) }, 0)).toEqual({ keepPolling: true });
    },
  );

  it('stops as not-found for RENDER_JOB_NOT_FOUND, regardless of prior transport failures', () => {
    const error = new RenderApiError('RENDER_JOB_NOT_FOUND', 'gone', 404, null);

    expect(nextPollPlan({ kind: 'error', error }, 0)).toEqual({ keepPolling: false, reason: 'not-found' });
    expect(nextPollPlan({ kind: 'error', error }, 2)).toEqual({ keepPolling: false, reason: 'not-found' });
  });

  it('keeps polling through the first two consecutive transport failures', () => {
    const error = new RenderApiError('SERVICE_UNREACHABLE', 'down', null, null);

    expect(nextPollPlan({ kind: 'error', error }, 0)).toEqual({ keepPolling: true });
    expect(nextPollPlan({ kind: 'error', error }, 1)).toEqual({ keepPolling: true });
  });

  it('stops as unreachable on the third consecutive transport failure', () => {
    const error = new RenderApiError('SERVICE_UNREACHABLE', 'down', null, null);

    expect(nextPollPlan({ kind: 'error', error }, RENDER_JOB_POLL_TRANSPORT_RETRY_LIMIT - 1)).toEqual({
      keepPolling: false,
      reason: 'unreachable',
    });
  });

  it('stops immediately as unreachable for any other RenderApiError, without spending a retry', () => {
    const error = new RenderApiError('RESPONSE_SHAPE_UNEXPECTED', 'bad shape', 200, null);

    expect(nextPollPlan({ kind: 'error', error }, 0)).toEqual({ keepPolling: false, reason: 'unreachable' });
  });
});
