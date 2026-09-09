import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RenderApiProvider } from '../api/render-api-context';
import { RenderApiError } from '../api/render-api-error';
import { renderJobDeliverableUrl } from '../api/render-job-artifact';
import { RENDER_JOB_POLL_INTERVAL_MS } from '../api/render-job-poll-plan';
import { RenderJobPanel } from './render-job-panel';
import type { RenderApiClient } from '../api/render-api-client';
import type { RenderJob, RenderJobState } from '../api/render-api-types';

function job(overrides: Partial<RenderJob> = {}): RenderJob {
  return {
    id: 'job-0001',
    kind: 'render',
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
  cancelRenderJob: RenderApiClient['cancelRenderJob'] = vi.fn(),
) {
  render(
    <RenderApiProvider client={{ getRenderJob, cancelRenderJob } as unknown as RenderApiClient}>
      <RenderJobPanel slug="smoke-ingest" jobId="job-0001" />
    </RenderApiProvider>,
  );
}

describe('RenderJobPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows renderedFrames/totalFrames/percent only during the render stage (T-34)', async () => {
    const getRenderJob = vi
      .fn()
      .mockResolvedValue(
        job({ progress: { stage: 'render', renderedFrames: 240, totalFrames: 538, percent: 44.6 } }),
      );
    renderPanel(getRenderJob as unknown as RenderApiClient['getRenderJob']);

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText(/240\/538 frames/)).toBeTruthy();
  });

  it('shows no frame count outside the render stage', async () => {
    const getRenderJob = vi
      .fn()
      .mockResolvedValue(job({ progress: { stage: 'prepare', renderedFrames: null, totalFrames: null, percent: null } }));
    renderPanel(getRenderJob as unknown as RenderApiClient['getRenderJob']);

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('stage: prepare')).toBeTruthy();
    expect(screen.queryByText(/frames/)).toBeNull();
  });

  it('shows state: failed with error.code and error.message from the job body, not as a network error (T-36)', async () => {
    const getRenderJob = vi.fn().mockResolvedValue(
      job({
        state: 'failed',
        progress: null,
        error: { code: 'INVALID_TIMELINE', stage: 'render', message: 'The timeline failed validation.' },
      }),
    );
    renderPanel(getRenderJob as unknown as RenderApiClient['getRenderJob']);

    await act(async () => {
      await Promise.resolve();
    });

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('INVALID_TIMELINE');
    expect(alert.textContent).toContain('The timeline failed validation.');
  });

  it('stops offering cancel and shows terminal once canceled (T-40)', async () => {
    const getRenderJob = vi.fn().mockResolvedValue(job({ state: 'canceled', progress: null }));
    renderPanel(getRenderJob as unknown as RenderApiClient['getRenderJob']);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('state: canceled')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });

  it('keeps offering cancel while canceling (not terminal) (T-40)', async () => {
    const getRenderJob = vi.fn().mockResolvedValue(job({ state: 'canceling' }));
    renderPanel(getRenderJob as unknown as RenderApiClient['getRenderJob']);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('state: canceling')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
  });

  it('shows RENDER_JOB_NOT_CANCELABLE on a 409 without altering the displayed job state (T-40)', async () => {
    const getRenderJob = vi.fn().mockResolvedValue(job({ state: 'running' }));
    const cancelRenderJob = vi
      .fn()
      .mockRejectedValue(new RenderApiError('RENDER_JOB_NOT_CANCELABLE', 'Already terminal.', 409, null));
    renderPanel(
      getRenderJob as unknown as RenderApiClient['getRenderJob'],
      cancelRenderJob as unknown as RenderApiClient['cancelRenderJob'],
    );

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      screen.getByRole('button', { name: 'Cancel' }).click();
      await Promise.resolve();
    });

    expect(screen.getByRole('alert').textContent).toContain('RENDER_JOB_NOT_CANCELABLE');
    expect(screen.getByText('state: running')).toBeTruthy();
  });

  it('links the download to renderJobDeliverableUrl only when state is succeeded (T-45 / T-46)', async () => {
    const getRenderJob = vi.fn().mockResolvedValue(job({ state: 'succeeded', progress: null }));
    renderPanel(getRenderJob as unknown as RenderApiClient['getRenderJob']);

    await act(async () => {
      await Promise.resolve();
    });

    const link = screen.getByRole('link', { name: 'Download' }) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe(renderJobDeliverableUrl('smoke-ingest', 'job-0001'));
  });

  it('shows no download link for any non-succeeded state (T-46)', async () => {
    const states: RenderJobState[] = ['queued', 'running', 'canceling', 'failed', 'canceled'];

    for (const state of states) {
      const getRenderJob = vi.fn().mockResolvedValue(job({ state, progress: null }));
      const { unmount } = render(
        <RenderApiProvider client={{ getRenderJob } as unknown as RenderApiClient}>
          <RenderJobPanel slug="smoke-ingest" jobId="job-0001" />
        </RenderApiProvider>,
      );

      await act(async () => {
        await Promise.resolve();
      });
      expect(screen.queryByRole('link', { name: 'Download' })).toBeNull();
      unmount();
    }
  });

  it('says the job may have been lost on a 404 (RENDER_JOB_NOT_FOUND), instead of spinning forever', async () => {
    const getRenderJob = vi
      .fn()
      .mockRejectedValue(new RenderApiError('RENDER_JOB_NOT_FOUND', 'gone', 404, null));
    renderPanel(getRenderJob as unknown as RenderApiClient['getRenderJob']);

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole('alert').textContent).toContain('RENDER_JOB_NOT_FOUND');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RENDER_JOB_POLL_INTERVAL_MS * 3);
    });
    expect(getRenderJob).toHaveBeenCalledTimes(1);
  });

  it('shows nothing to poll when no job is selected', () => {
    render(
      <RenderApiProvider client={{ getRenderJob: vi.fn() } as unknown as RenderApiClient}>
        <RenderJobPanel slug="smoke-ingest" jobId={null} />
      </RenderApiProvider>,
    );

    expect(screen.getByText('No render job selected.')).toBeTruthy();
  });
});
