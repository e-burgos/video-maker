import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RenderApiProvider } from '../api/render-api-context';
import { RenderApiError } from '../api/render-api-error';
import { StoryboardJobPanel } from './storyboard-job-panel';
import type { RenderApiClient } from '../api/render-api-client';
import type { StoryboardJob } from '../api/render-api-types';

function job(overrides: Partial<StoryboardJob> = {}): StoryboardJob {
  return {
    id: 'job-0009',
    kind: 'storyboard',
    slug: 'smoke-ingest',
    state: 'running',
    createdAt: '2026-09-09T12:00:00.000Z',
    startedAt: '2026-09-09T12:00:00.500Z',
    finishedAt: null,
    progress: { stage: 'propose', percent: 66 },
    report: null,
    error: null,
    ...overrides,
  };
}

function renderPanel(getRenderJob: RenderApiClient['getRenderJob'], jobId: string | null = 'job-0009') {
  const onSucceeded = vi.fn();

  render(
    <RenderApiProvider client={{ getRenderJob } as unknown as RenderApiClient}>
      <StoryboardJobPanel jobId={jobId} onSucceeded={onSucceeded} />
    </RenderApiProvider>,
  );

  return onSucceeded;
}

describe('StoryboardJobPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing until a job has been created', () => {
    const { container } = render(
      <RenderApiProvider client={{ getRenderJob: vi.fn() } as unknown as RenderApiClient}>
        <StoryboardJobPanel jobId={null} onSucceeded={vi.fn()} />
      </RenderApiProvider>,
    );

    expect(container.textContent).toBe('');
  });

  it('names the propose stage and warns that it is a real model call', async () => {
    renderPanel(vi.fn().mockResolvedValue(job()));

    await waitFor(() => expect(screen.getByTestId('storyboard-stage').textContent).toBe('stage: propose'));
    expect(screen.getByText(/takes more than a minute/)).toBeTruthy();
  });

  it('describes the collect and persist stages too', async () => {
    renderPanel(vi.fn().mockResolvedValue(job({ progress: { stage: 'collect', percent: 33 } })));

    await waitFor(() => expect(screen.getByText(/catalog, transcript/)).toBeTruthy());
  });

  it('reports the produced storyboard once the job succeeds, and calls back exactly once', async () => {
    const succeeded = job({
      state: 'succeeded',
      finishedAt: '2026-09-09T12:01:40.000Z',
      progress: { stage: 'persist', percent: 100 },
      report: {
        storyboardPath: 'work/storyboard.json',
        storyboardId: 'storyboard-0001',
        source: 'brief',
        language: 'es-AR',
        sceneCount: 8,
        usage: { tokensIn: 4200, tokensOut: 3100, costUsd: 0.31, model: 'claude-opus-4' },
      },
    });
    const onSucceeded = renderPanel(vi.fn().mockResolvedValue(succeeded));

    await waitFor(() => expect(onSucceeded).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('storyboard-job-panel').getAttribute('data-storyboard-state')).toBe(
      'succeeded',
    );
    expect(screen.getByText(/8 scenes/)).toBeTruthy();
  });

  it('explains a failed job by its typed code and in the language of the user', async () => {
    renderPanel(
      vi.fn().mockResolvedValue(
        job({
          state: 'failed',
          progress: { stage: 'propose', percent: 66 },
          error: { code: 'AI_AGENT_UNAVAILABLE', stage: 'propose', message: 'agent not found' },
        }),
      ),
    );

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('AI_AGENT_UNAVAILABLE'));
    expect(screen.getByTestId('storyboard-failure-explanation').textContent).toContain(
      'Install Claude Code',
    );
  });

  it('shows a failed job with an unknown code without inventing an explanation', async () => {
    renderPanel(
      vi.fn().mockResolvedValue(
        job({
          state: 'failed',
          error: { code: 'INTERNAL_ERROR', stage: null, message: 'boom' },
        }),
      ),
    );

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('INTERNAL_ERROR'));
    expect(screen.queryByTestId('storyboard-failure-explanation')).toBeNull();
  });

  it('says the job may have been lost when the service answers 404', async () => {
    renderPanel(
      vi.fn().mockRejectedValue(new RenderApiError('RENDER_JOB_NOT_FOUND', 'gone', 404, null)),
    );

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('may have been lost'));
  });

  it('shows the transport error while no job document could be read yet', async () => {
    renderPanel(
      vi.fn().mockRejectedValue(new RenderApiError('SERVICE_UNREACHABLE', 'no answer', null, null)),
    );

    await waitFor(() => expect(screen.getByText('SERVICE_UNREACHABLE')).toBeTruthy());
  });
});
