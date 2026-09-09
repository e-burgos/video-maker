import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RenderApiError } from '../api/render-api-error';
import { RENDER_JOB_POLL_INTERVAL_MS } from '../api/render-job-poll-plan';
import { useRenderJobPoll } from './use-render-job-poll';
import type { RenderJob, RenderJobState } from '../api/render-api-types';

function jobWithState(state: RenderJobState): RenderJob {
  return {
    id: 'job-0001',
    kind: 'render',
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

describe('useRenderJobPoll', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does nothing while there is no jobId selected', () => {
    const load = vi.fn<(jobId: string) => Promise<RenderJob>>();
    const { result } = renderHook(() => useRenderJobPoll(null, load));

    expect(result.current.polling).toBe(false);
    expect(result.current.job).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it('ticks every RENDER_JOB_POLL_INTERVAL_MS, re-scheduled only after the previous response settles, and reflects each state as it arrives', async () => {
    const load = vi
      .fn<(jobId: string) => Promise<RenderJob>>()
      .mockResolvedValueOnce(jobWithState('queued'))
      .mockResolvedValueOnce(jobWithState('running'))
      .mockResolvedValueOnce(jobWithState('canceling'))
      .mockResolvedValueOnce(jobWithState('succeeded'));

    const { result } = renderHook(() => useRenderJobPoll('job-0001', load));

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.job?.state).toBe('queued');
    expect(result.current.polling).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RENDER_JOB_POLL_INTERVAL_MS);
    });
    expect(result.current.job?.state).toBe('running');
    expect(load).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RENDER_JOB_POLL_INTERVAL_MS);
    });
    expect(result.current.job?.state).toBe('canceling');
    expect(result.current.polling).toBe(true);
    expect(load).toHaveBeenCalledTimes(3);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RENDER_JOB_POLL_INTERVAL_MS);
    });
    expect(result.current.job?.state).toBe('succeeded');
    expect(result.current.polling).toBe(false);
    expect(result.current.stopReason).toBe('terminal');
    expect(load).toHaveBeenCalledTimes(4);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RENDER_JOB_POLL_INTERVAL_MS * 3);
    });
    expect(load).toHaveBeenCalledTimes(4);
  });

  it.each<RenderJobState>(['failed', 'canceled'])('stops polling once the job reaches %s', async (state) => {
    const load = vi.fn<(jobId: string) => Promise<RenderJob>>().mockResolvedValue(jobWithState(state));
    const { result } = renderHook(() => useRenderJobPoll('job-0001', load));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.job?.state).toBe(state);
    expect(result.current.polling).toBe(false);
    expect(result.current.stopReason).toBe('terminal');
  });

  it('stops after a 404, exposes the code and never ticks again', async () => {
    const notFound = new RenderApiError('RENDER_JOB_NOT_FOUND', 'gone', 404, null);
    const load = vi.fn<(jobId: string) => Promise<RenderJob>>().mockRejectedValue(notFound);

    const { result } = renderHook(() => useRenderJobPoll('job-0001', load));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.polling).toBe(false);
    expect(result.current.stopReason).toBe('not-found');
    expect(result.current.error?.code).toBe('RENDER_JOB_NOT_FOUND');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RENDER_JOB_POLL_INTERVAL_MS * 5);
    });

    expect(load).toHaveBeenCalledTimes(1);
  });

  it('retries a transport failure up to the limit before stopping as unreachable', async () => {
    const transportError = new RenderApiError('SERVICE_UNREACHABLE', 'down', null, null);
    const load = vi.fn<(jobId: string) => Promise<RenderJob>>().mockRejectedValue(transportError);

    const { result } = renderHook(() => useRenderJobPoll('job-0001', load));

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.polling).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RENDER_JOB_POLL_INTERVAL_MS);
    });
    expect(result.current.polling).toBe(true);
    expect(load).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RENDER_JOB_POLL_INTERVAL_MS);
    });
    expect(result.current.polling).toBe(false);
    expect(result.current.stopReason).toBe('unreachable');
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('clears the pending timer when the component unmounts', async () => {
    const load = vi.fn<(jobId: string) => Promise<RenderJob>>().mockResolvedValue(jobWithState('running'));
    const { unmount } = renderHook(() => useRenderJobPoll('job-0001', load));

    await act(async () => {
      await Promise.resolve();
    });
    expect(load).toHaveBeenCalledTimes(1);

    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RENDER_JOB_POLL_INTERVAL_MS * 3);
    });

    expect(load).toHaveBeenCalledTimes(1);
  });

  it('clears the pending timer of the previous job and restarts when jobId changes', async () => {
    const load = vi
      .fn<(jobId: string) => Promise<RenderJob>>()
      .mockResolvedValueOnce(jobWithState('running'))
      .mockResolvedValueOnce(jobWithState('succeeded'));

    const { result, rerender } = renderHook(
      ({ jobId }: { jobId: string }) => useRenderJobPoll(jobId, load),
      { initialProps: { jobId: 'job-0001' } },
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenLastCalledWith('job-0001');

    rerender({ jobId: 'job-0002' });
    expect(result.current.job).toBeNull();
    expect(result.current.polling).toBe(true);

    await act(async () => {
      await Promise.resolve();
    });
    expect(load).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenLastCalledWith('job-0002');
    expect(result.current.job?.state).toBe('succeeded');
    expect(result.current.polling).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RENDER_JOB_POLL_INTERVAL_MS * 3);
    });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('discards a stale tick that resolves after jobId already moved on', async () => {
    let resolveStale: (job: RenderJob) => void = () => undefined;
    const load = vi
      .fn<(jobId: string) => Promise<RenderJob>>()
      .mockImplementationOnce(
        () =>
          new Promise<RenderJob>((resolve) => {
            resolveStale = resolve;
          }),
      )
      .mockResolvedValueOnce(jobWithState('running'));

    const { result, rerender } = renderHook(
      ({ jobId }: { jobId: string }) => useRenderJobPoll(jobId, load),
      { initialProps: { jobId: 'job-0001' } },
    );

    rerender({ jobId: 'job-0002' });

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.job?.state).toBe('running');

    await act(async () => {
      resolveStale(jobWithState('succeeded'));
      await Promise.resolve();
    });

    expect(result.current.job?.state).toBe('running');
    expect(result.current.polling).toBe(true);
  });

  it('discards a stale tick that rejects after jobId already moved on', async () => {
    let rejectStale: (cause: unknown) => void = () => undefined;
    const load = vi
      .fn<(jobId: string) => Promise<RenderJob>>()
      .mockImplementationOnce(
        () =>
          new Promise<RenderJob>((_resolve, reject) => {
            rejectStale = reject;
          }),
      )
      .mockResolvedValueOnce(jobWithState('running'));

    const { result, rerender } = renderHook(
      ({ jobId }: { jobId: string }) => useRenderJobPoll(jobId, load),
      { initialProps: { jobId: 'job-0001' } },
    );

    rerender({ jobId: 'job-0002' });

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.job?.state).toBe('running');

    await act(async () => {
      rejectStale(new RenderApiError('RENDER_JOB_NOT_FOUND', 'gone', 404, null));
      await Promise.resolve();
    });

    expect(result.current.job?.state).toBe('running');
    expect(result.current.polling).toBe(true);
    expect(result.current.error).toBeNull();
  });
});
