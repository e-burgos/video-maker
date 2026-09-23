import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RenderApiProvider } from '../api/render-api-context';
import { RenderApiError } from '../api/render-api-error';
import { JobRetryButton } from './job-retry-button';
import type { RenderApiClient } from '../api/render-api-client';
import type { RenderJob } from '../api/render-api-types';

function job(overrides: Partial<RenderJob> = {}): RenderJob {
  return {
    id: 'job-0001',
    kind: 'render',
    slug: 'smoke-ingest',
    state: 'failed',
    createdAt: '2026-09-23T10:00:00.000Z',
    startedAt: '2026-09-23T10:00:01.000Z',
    finishedAt: '2026-09-23T10:00:02.000Z',
    progress: null,
    report: null,
    error: { code: 'JOB_INTERRUPTED', stage: null, message: 'interrupted' },
    ...overrides,
  };
}

function renderButton(retryJob: RenderApiClient['retryJob'], onRetried = vi.fn(), overrides: Partial<RenderJob> = {}) {
  render(
    <RenderApiProvider client={{ retryJob } as unknown as RenderApiClient}>
      <JobRetryButton job={job(overrides)} onRetried={onRetried} />
    </RenderApiProvider>,
  );
  return { onRetried };
}

describe('JobRetryButton', () => {
  it('shows nothing for a job that is not failed or canceled', () => {
    renderButton(vi.fn(), vi.fn(), { state: 'running', error: null });
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows the button for a failed job', () => {
    renderButton(vi.fn());
    expect(screen.getByRole('button', { name: 'Run again' })).toBeTruthy();
  });

  it('shows the button for a canceled job', () => {
    renderButton(vi.fn(), vi.fn(), { state: 'canceled', error: null });
    expect(screen.getByRole('button', { name: 'Run again' })).toBeTruthy();
  });

  it('retries the job on click and hands the new job to onRetried', async () => {
    const newJob = job({ id: 'job-0002', state: 'queued', error: null });
    const retryJob = vi.fn().mockResolvedValue(newJob);
    const { onRetried } = renderButton(retryJob);

    await act(async () => {
      screen.getByRole('button', { name: 'Run again' }).click();
      await Promise.resolve();
    });

    expect(retryJob).toHaveBeenCalledWith('job-0001');
    expect(onRetried).toHaveBeenCalledWith(newJob);
  });

  it('shows the translated error and never calls onRetried on failure', async () => {
    const retryJob = vi
      .fn()
      .mockRejectedValue(new RenderApiError('JOB_NOT_RETRYABLE', 'not retryable', 409, null));
    const { onRetried } = renderButton(retryJob);

    await act(async () => {
      screen.getByRole('button', { name: 'Run again' }).click();
      await Promise.resolve();
    });

    expect(screen.getByRole('alert').textContent).toContain('JOB_NOT_RETRYABLE');
    expect(onRetried).not.toHaveBeenCalled();
  });
});
