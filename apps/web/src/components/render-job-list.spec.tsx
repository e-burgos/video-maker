import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RenderApiProvider } from '../api/render-api-context';
import { RenderJobList } from './render-job-list';
import type { RenderApiClient } from '../api/render-api-client';
import type { RenderJobListing, RenderJobSummary } from '../api/render-api-types';

function summary(overrides: Partial<RenderJobSummary> & Pick<RenderJobSummary, 'id'>): RenderJobSummary {
  return {
    state: 'queued',
    stage: null,
    errorCode: null,
    createdAt: '2026-09-09T10:00:00.000Z',
    startedAt: null,
    finishedAt: null,
    ...overrides,
  };
}

function renderList(listRenderJobs: RenderApiClient['listRenderJobs'], onSelect = vi.fn()) {
  render(
    <RenderApiProvider client={{ listRenderJobs } as unknown as RenderApiClient}>
      <RenderJobList slug="smoke-ingest" onSelect={onSelect} />
    </RenderApiProvider>,
  );
  return onSelect;
}

describe('RenderJobList', () => {
  it('shows every job with its seven fields and a way to select it by id', async () => {
    const listing: RenderJobListing = {
      slug: 'smoke-ingest',
      jobs: [
        summary({
          id: 'job-0001',
          state: 'running',
          stage: 'render',
          startedAt: '2026-09-09T10:00:01.000Z',
        }),
      ],
    };
    const listRenderJobs = vi.fn().mockResolvedValue(listing);
    const onSelect = renderList(listRenderJobs as unknown as RenderApiClient['listRenderJobs']);

    await waitFor(() => expect(screen.getByText('job-0001')).toBeTruthy());
    expect(screen.getByText('running')).toBeTruthy();
    expect(screen.getByText('render')).toBeTruthy();
    expect(screen.getByText('2026-09-09T10:00:00.000Z')).toBeTruthy();
    expect(screen.getByText('2026-09-09T10:00:01.000Z')).toBeTruthy();

    fireEvent.click(screen.getByText('job-0001'));
    expect(onSelect).toHaveBeenCalledWith('job-0001');
  });

  it('shows the friendly interrupted text in the error column instead of the raw JOB_INTERRUPTED code', async () => {
    const listing: RenderJobListing = {
      slug: 'smoke-ingest',
      jobs: [summary({ id: 'job-0001', state: 'failed', errorCode: 'JOB_INTERRUPTED' })],
    };
    const listRenderJobs = vi.fn().mockResolvedValue(listing);
    renderList(listRenderJobs as unknown as RenderApiClient['listRenderJobs']);

    await waitFor(() => expect(screen.getByText('job-0001')).toBeTruthy());
    expect(screen.getByText('Interrupted')).toBeTruthy();
    expect(screen.queryByText('JOB_INTERRUPTED')).toBeNull();
  });

  it('shows any other error code as-is, unlike the interrupted one', async () => {
    const listing: RenderJobListing = {
      slug: 'smoke-ingest',
      jobs: [summary({ id: 'job-0001', state: 'failed', errorCode: 'RENDER_FAILED' })],
    };
    const listRenderJobs = vi.fn().mockResolvedValue(listing);
    renderList(listRenderJobs as unknown as RenderApiClient['listRenderJobs']);

    await waitFor(() => expect(screen.getByText('RENDER_FAILED')).toBeTruthy());
  });

  it('renders an empty jobs array as an empty list, without ErrorNotice', async () => {
    const listRenderJobs = vi.fn().mockResolvedValue({ slug: 'smoke-ingest', jobs: [] });
    renderList(listRenderJobs as unknown as RenderApiClient['listRenderJobs']);

    await waitFor(() => expect(screen.getByText('No render jobs yet.')).toBeTruthy());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps the previous rows visible while refreshing (D-3): no blanking on reload', async () => {
    let resolveSecond: (value: RenderJobListing) => void = () => undefined;
    const listRenderJobs = vi
      .fn()
      .mockResolvedValueOnce({ slug: 'smoke-ingest', jobs: [summary({ id: 'job-0001' })] })
      .mockImplementationOnce(
        () =>
          new Promise<RenderJobListing>((resolve) => {
            resolveSecond = resolve;
          }),
      );
    renderList(listRenderJobs as unknown as RenderApiClient['listRenderJobs']);

    await waitFor(() => expect(screen.getByText('job-0001')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(screen.getByText('job-0001')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Refreshing…' })).toBeTruthy();

    await act(async () => {
      resolveSecond({ slug: 'smoke-ingest', jobs: [summary({ id: 'job-0002' })] });
    });

    await waitFor(() => expect(screen.getByText('job-0002')).toBeTruthy());
    expect(screen.queryByText('job-0001')).toBeNull();
  });
});
