import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { editableTimelineFixture } from '../api/__fixtures__/editable-timeline';
import { RenderApiProvider } from '../api/render-api-context';
import { RenderApiError } from '../api/render-api-error';
import { initialTimelineEditState } from '../api/timeline-edit/timeline-edit-state';
import { RenderTrigger } from './render-trigger';
import type { RenderApiClient } from '../api/render-api-client';
import type { RenderJob } from '../api/render-api-types';
import type { TimelineEditState } from '../api/timeline-edit/timeline-edit-state';

function renderTrigger(
  state: TimelineEditState,
  createRenderJob: RenderApiClient['createRenderJob'],
  onCreated = vi.fn(),
) {
  render(
    <RenderApiProvider client={{ createRenderJob } as unknown as RenderApiClient}>
      <RenderTrigger slug="smoke-ingest" state={state} onCreated={onCreated} />
    </RenderApiProvider>,
  );
  return onCreated;
}

function renderJob(overrides: Partial<RenderJob> = {}): RenderJob {
  return {
    id: 'job-0001',
    kind: 'render',
    slug: 'smoke-ingest',
    state: 'queued',
    createdAt: '2026-09-09T10:00:00.000Z',
    startedAt: null,
    finishedAt: null,
    progress: null,
    report: null,
    error: null,
    ...overrides,
  };
}

describe('RenderTrigger', () => {
  it('is disabled with unsaved changes, showing the reason in the DOM', () => {
    const fixture = editableTimelineFixture();
    const state = { ...initialTimelineEditState(fixture), dirty: true };

    renderTrigger(state, vi.fn());

    const button = screen.getByRole('button', { name: 'Render' });
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Save your changes before rendering.')).toBeTruthy();
  });

  it('is disabled with a render-blocking issue, naming its code in the DOM', () => {
    const fixture = editableTimelineFixture();
    const state = {
      ...initialTimelineEditState(fixture),
      dirty: false,
      issues: [
        {
          code: 'CLIP_EXCEEDS_ASSET' as const,
          path: 'tracks.aroll[0].durationFrames',
          message: 'The clip exceeds the asset.',
        },
      ],
    };

    renderTrigger(state, vi.fn());

    expect(screen.getByRole('button', { name: 'Render' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('CLIP_EXCEEDS_ASSET')).toBeTruthy();
  });

  it('is enabled only when canStartRender is true: saved and no blocking issues', () => {
    const fixture = editableTimelineFixture();
    const state = initialTimelineEditState(fixture);

    renderTrigger(state, vi.fn());

    expect(screen.getByRole('button', { name: 'Render' }).hasAttribute('disabled')).toBe(false);
  });

  it('emits the POST once, shows the job id on the 202 without a reload, and reports it upward', async () => {
    const fixture = editableTimelineFixture();
    const state = initialTimelineEditState(fixture);
    const job = renderJob();
    const createRenderJob = vi.fn().mockResolvedValue(job);
    const onCreated = renderTrigger(
      state,
      createRenderJob as unknown as RenderApiClient['createRenderJob'],
    );

    fireEvent.click(screen.getByRole('button', { name: 'Render' }));

    await waitFor(() => expect(screen.getByText(/job-0001/)).toBeTruthy());
    expect(createRenderJob).toHaveBeenCalledTimes(1);
    expect(createRenderJob).toHaveBeenCalledWith('smoke-ingest');
    expect(onCreated).toHaveBeenCalledWith(job);
  });

  it.each([
    ['PROJECT_NOT_FOUND', 404],
    ['TIMELINE_NOT_FOUND', 404],
    ['TIMELINE_INVALID', 422],
  ])('shows %s from EP-012 with its code and never reports a job upward', async (code, status) => {
    const fixture = editableTimelineFixture();
    const state = initialTimelineEditState(fixture);
    const createRenderJob = vi
      .fn()
      .mockRejectedValue(new RenderApiError(code, `${code} happened.`, status, null));
    const onCreated = renderTrigger(
      state,
      createRenderJob as unknown as RenderApiClient['createRenderJob'],
    );

    fireEvent.click(screen.getByRole('button', { name: 'Render' }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain(code));
    expect(onCreated).not.toHaveBeenCalled();
  });
});
