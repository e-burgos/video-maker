import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { editableTimelineFixture } from '../api/__fixtures__/editable-timeline';
import { RenderApiProvider } from '../api/render-api-context';
import { RenderApiError } from '../api/render-api-error';
import { initialTimelineEditState } from '../api/timeline-edit/timeline-edit-state';
import { TimelineSaveBar } from './timeline-save-bar';
import type { RenderApiClient } from '../api/render-api-client';
import type { TimelineEditState } from '../api/timeline-edit/timeline-edit-state';

function renderSaveBar(
  state: TimelineEditState,
  putTimeline: RenderApiClient['putTimeline'],
  dispatch = vi.fn(),
) {
  render(
    <RenderApiProvider client={{ putTimeline } as unknown as RenderApiClient}>
      <TimelineSaveBar slug="smoke-ingest" state={state} dispatch={dispatch} />
    </RenderApiProvider>,
  );
  return dispatch;
}

describe('TimelineSaveBar', () => {
  it('is disabled without unsaved changes, showing Saved and dirty=false', () => {
    const fixture = editableTimelineFixture();
    const state = initialTimelineEditState(fixture);

    renderSaveBar(state, vi.fn());

    expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Saved')).toBeTruthy();
    expect(screen.getByTestId('timeline-save-bar').getAttribute('data-timeline-dirty')).toBe('false');
  });

  it('is enabled with unsaved changes and no issues, showing Unsaved changes and dirty=true', () => {
    const fixture = editableTimelineFixture();
    const state = { ...initialTimelineEditState(fixture), dirty: true };

    renderSaveBar(state, vi.fn());

    expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
    expect(screen.getByTestId('timeline-save-bar').getAttribute('data-timeline-dirty')).toBe('true');
  });

  it('stays enabled with a render-blocking issue present (APR-01) — the other half of T-09', () => {
    const fixture = editableTimelineFixture();
    const state = {
      ...initialTimelineEditState(fixture),
      dirty: true,
      issues: [
        {
          code: 'CLIP_EXCEEDS_ASSET' as const,
          path: 'tracks.aroll[0].durationFrames',
          message: 'The clip exceeds the asset.',
        },
      ],
    };

    renderSaveBar(state, vi.fn());

    expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(false);
  });

  it('is disabled with a save-blocking issue (SCHEMA_INVALID), even with unsaved changes', () => {
    const fixture = editableTimelineFixture();
    const state = {
      ...initialTimelineEditState(fixture),
      dirty: true,
      issues: [{ code: 'SCHEMA_INVALID' as const, path: 'root', message: 'Does not validate.' }],
    };

    renderSaveBar(state, vi.fn());

    expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(true);
  });

  it('is disabled while a rejection is pending, even with unsaved changes', () => {
    const fixture = editableTimelineFixture();
    const state = {
      ...initialTimelineEditState(fixture),
      dirty: true,
      rejections: [{ code: 'TRIM_START_MS_INVALID' as const, path: 'x', message: 'x' }],
    };

    renderSaveBar(state, vi.fn());

    expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(true);
  });

  it('sends the full draft document to putTimeline and dispatches saved only on success', async () => {
    const fixture = editableTimelineFixture();
    const state = { ...initialTimelineEditState(fixture), dirty: true };
    const putTimeline = vi.fn().mockResolvedValue({ slug: 'smoke-ingest', path: 'work/timeline.json' });
    const dispatch = renderSaveBar(state, putTimeline as unknown as RenderApiClient['putTimeline']);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith({ type: 'saved', timeline: state.draft }),
    );
    expect(putTimeline).toHaveBeenCalledWith('smoke-ingest', state.draft);
  });

  it('shows the service code after a 422 and never dispatches saved: nothing was written', async () => {
    const fixture = editableTimelineFixture();
    const state = { ...initialTimelineEditState(fixture), dirty: true };
    const putTimeline = vi
      .fn()
      .mockRejectedValue(
        new RenderApiError('TIMELINE_INVALID', 'The document failed validation.', 422, null),
      );
    const dispatch = renderSaveBar(state, putTimeline as unknown as RenderApiClient['putTimeline']);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('TIMELINE_INVALID'));
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'saved' }));
  });
});
