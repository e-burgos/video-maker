import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RenderApiProvider } from '../api/render-api-context';
import { RenderApiError } from '../api/render-api-error';
import { RENDER_JOB_POLL_INTERVAL_MS } from '../api/render-job-poll-plan';
import { MontageJobPanel } from './montage-job-panel';
import type { RenderApiClient } from '../api/render-api-client';
import type { MontageJob } from '../api/render-api-types';

function job(overrides: Partial<MontageJob> = {}): MontageJob {
  return {
    id: 'job-0002',
    kind: 'montage',
    slug: 'smoke-ingest',
    state: 'running',
    createdAt: '2026-09-09T10:00:00.000Z',
    startedAt: '2026-09-09T10:00:01.000Z',
    finishedAt: null,
    progress: null,
    report: null,
    error: null,
    ...overrides,
  };
}

function renderPanel(
  getRenderJob: RenderApiClient['getRenderJob'],
  jobId: string | null = 'job-0002',
) {
  const onSucceeded = vi.fn();
  render(
    <RenderApiProvider client={{ getRenderJob } as unknown as RenderApiClient}>
      <MontageJobPanel jobId={jobId} onSucceeded={onSucceeded} onRetried={vi.fn()} />
    </RenderApiProvider>,
  );
  return onSucceeded;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function advanceOnePoll() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(RENDER_JOB_POLL_INTERVAL_MS);
  });
}

describe('MontageJobPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing until a montage job has been created', async () => {
    renderPanel(vi.fn(), null);
    await flush();

    expect(screen.queryByTestId('montage-job-panel')).toBeNull();
  });

  it('shows the current stage of the montage', async () => {
    const getRenderJob = vi.fn().mockResolvedValue(
      job({ progress: { stage: 'discover', processedAssets: null, totalAssets: null, percent: null } }),
    );
    renderPanel(getRenderJob);
    await flush();

    expect(screen.getByTestId('montage-stage').textContent).toBe('stage: discover');
  });

  it('shows the asset counter during transcribe, the slow stage', async () => {
    const getRenderJob = vi.fn().mockResolvedValue(
      job({ progress: { stage: 'transcribe', processedAssets: 2, totalAssets: 6, percent: 33 } }),
    );
    renderPanel(getRenderJob);
    await flush();

    expect(screen.getByTestId('montage-asset-progress').textContent).toBe('2/6 assets (33%)');
  });

  it('never shows a counter during discover or plan', async () => {
    const getRenderJob = vi.fn().mockResolvedValue(
      job({ progress: { stage: 'plan', processedAssets: null, totalAssets: null, percent: null } }),
    );
    renderPanel(getRenderJob);
    await flush();

    expect(screen.queryByTestId('montage-asset-progress')).toBeNull();
  });

  it('calls onSucceeded exactly once when the job settles as succeeded', async () => {
    const succeeded = job({
      state: 'succeeded',
      progress: null,
      finishedAt: '2026-09-09T10:00:06.000Z',
      report: {
        catalogPath: 'work/catalog.json',
        timelinePath: 'work/timeline.json',
        editDecisionListPath: 'work/edl.json',
        preset: 'software-demo',
        seed: 0,
      },
    });
    const getRenderJob = vi
      .fn()
      .mockResolvedValueOnce(
        job({ progress: { stage: 'probe', processedAssets: 1, totalAssets: 6, percent: 16 } }),
      )
      .mockResolvedValue(succeeded);

    const onSucceeded = renderPanel(getRenderJob);
    await flush();
    expect(onSucceeded).not.toHaveBeenCalled();

    await advanceOnePoll();

    expect(onSucceeded).toHaveBeenCalledTimes(1);
    expect(screen.getByText('work/timeline.json · preset software-demo · seed 0')).toBeTruthy();
  });

  it('shows the typed error code of a failed montage and never navigates', async () => {
    const getRenderJob = vi.fn().mockResolvedValue(
      job({
        state: 'failed',
        progress: null,
        finishedAt: '2026-09-09T10:00:04.000Z',
        error: {
          code: 'MONTAGE_INPUT_INVALID',
          stage: 'plan',
          message: 'The montage input does not have enough usable assets to build a timeline.',
        },
      }),
    );
    const onSucceeded = renderPanel(getRenderJob);
    await flush();

    expect(screen.getByRole('alert').textContent).toContain('MONTAGE_INPUT_INVALID');
    expect(onSucceeded).not.toHaveBeenCalled();
  });

  it('explains a job the queue lost to a restart', async () => {
    const getRenderJob = vi
      .fn()
      .mockRejectedValue(
        new RenderApiError('RENDER_JOB_NOT_FOUND', 'unknown job', 404, {
          code: 'RENDER_JOB_NOT_FOUND',
          stage: null,
          message: 'unknown job',
        }),
      );
    renderPanel(getRenderJob);
    await flush();

    expect(screen.getByRole('alert').textContent).toContain('RENDER_JOB_NOT_FOUND');
  });

  it('surfaces a transport failure with its notice', async () => {
    const getRenderJob = vi
      .fn()
      .mockRejectedValue(new RenderApiError('SERVICE_UNREACHABLE', 'no answer', null, null));
    renderPanel(getRenderJob);
    await flush();
    await advanceOnePoll();
    await advanceOnePoll();

    expect(screen.getByRole('alert').textContent).toContain('SERVICE_UNREACHABLE');
  });

  it('shows the Interrupted badge instead of the generic failure text for JOB_INTERRUPTED, plus a retry button', async () => {
    const getRenderJob = vi.fn().mockResolvedValue(
      job({
        state: 'failed',
        progress: null,
        error: { code: 'JOB_INTERRUPTED', stage: null, message: 'interrupted' },
      }),
    );
    renderPanel(getRenderJob);
    await flush();

    expect(screen.getByText('Interrupted')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: 'Run again' })).toBeTruthy();
  });
});
