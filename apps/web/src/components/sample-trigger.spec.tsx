import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import type { RenderApiClient } from '../api/render-api-client';
import { RenderApiProvider } from '../api/render-api-context';
import type { Job } from '../api/render-api-types';
import { SampleTrigger } from './sample-trigger';

const BASE = {
  slug: 'demo-01',
  createdAt: '2026-10-12T10:00:00.000Z',
  startedAt: null,
  finishedAt: null,
  error: null,
};

function renderJob(overrides: Record<string, unknown> = {}): Job {
  return { ...BASE, id: 'job-0007', kind: 'render', state: 'queued', progress: null, report: null, ...overrides } as Job;
}

function motionJob(overrides: Record<string, unknown> = {}): Job {
  return { ...BASE, id: 'job-0008', kind: 'motion', state: 'queued', progress: null, report: null, ...overrides } as Job;
}

function renderTrigger(kind: 'render' | 'motion', client: Partial<RenderApiClient>, disabled = false) {
  return render(
    <RenderApiProvider client={client as RenderApiClient}>
      <MemoryRouter>
        <SampleTrigger slug="demo-01" kind={kind} disabled={disabled} />
      </MemoryRouter>
    </RenderApiProvider>,
  );
}

describe('SampleTrigger', () => {
  it('queues a 10 s render sample and plays the .sample.mp4 when it succeeds', async () => {
    const createRenderJob = vi.fn().mockResolvedValue(renderJob());
    const getRenderJob = vi.fn().mockResolvedValue(
      renderJob({ state: 'succeeded', report: { sample: true } }),
    );
    renderTrigger('render', { createRenderJob, getRenderJob });

    fireEvent.click(screen.getByRole('button', { name: 'Generate sample (10 s)' }));

    await waitFor(() => expect(createRenderJob).toHaveBeenCalledWith('demo-01', { sample: { seconds: 10 } }));
    const video = await screen.findByLabelText('Sample video');
    expect(video.getAttribute('src')).toBe('/api/projects/demo-01/files/out/job-0007.sample.mp4');
    expect(screen.getByText('Sample')).toBeTruthy();
    expect(screen.getByText('Sample ready')).toBeTruthy();
  });

  it('queues a motion sample with the video phase and plays the reported path', async () => {
    const createMotionJob = vi.fn().mockResolvedValue(motionJob());
    const getRenderJob = vi.fn().mockResolvedValue(
      motionJob({
        state: 'succeeded',
        report: { path: 'out/video.sample.mp4', durationSec: 10, scenes: 3, storyboard: null, sample: true },
      }),
    );
    renderTrigger('motion', { createMotionJob, getRenderJob });

    fireEvent.click(screen.getByRole('button', { name: 'Generate sample (10 s)' }));

    await waitFor(() =>
      expect(createMotionJob).toHaveBeenCalledWith('demo-01', { phase: 'video', sample: { seconds: 10 } }),
    );
    const video = await screen.findByLabelText('Sample video');
    expect(video.getAttribute('src')).toBe('/api/projects/demo-01/files/out/video.sample.mp4');
  });

  it('shows progress while the render sample runs', async () => {
    const createRenderJob = vi.fn().mockResolvedValue(renderJob());
    const getRenderJob = vi.fn().mockResolvedValue(
      renderJob({ state: 'running', progress: { stage: 'render', renderedFrames: 30, totalFrames: 300, percent: 10 } }),
    );
    renderTrigger('render', { createRenderJob, getRenderJob });

    fireEvent.click(screen.getByRole('button', { name: 'Generate sample (10 s)' }));

    expect(await screen.findByText('Generating the sample…')).toBeTruthy();
    expect(screen.queryByLabelText('Sample video')).toBeNull();
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('reports a failed sample with its error code', async () => {
    const createRenderJob = vi.fn().mockResolvedValue(renderJob());
    const getRenderJob = vi.fn().mockResolvedValue(
      renderJob({ state: 'failed', error: { code: 'ASSET_MISSING', message: 'no clip' } }),
    );
    renderTrigger('render', { createRenderJob, getRenderJob });

    fireEvent.click(screen.getByRole('button', { name: 'Generate sample (10 s)' }));

    expect((await screen.findByRole('alert')).textContent).toContain('ASSET_MISSING');
  });

  it('disables the button when the caller blocks it', () => {
    renderTrigger('render', {}, true);

    expect((screen.getByRole('button', { name: 'Generate sample (10 s)' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
