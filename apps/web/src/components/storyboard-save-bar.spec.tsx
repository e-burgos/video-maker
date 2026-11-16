import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { storyboardFixture } from '../api/__fixtures__/storyboard';
import { RenderApiProvider } from '../api/render-api-context';
import { RenderApiError } from '../api/render-api-error';
import { setSceneText } from '../api/storyboard-edit/storyboard-document';
import { StoryboardSaveBar } from './storyboard-save-bar';
import type { RenderApiClient } from '../api/render-api-client';
import type { StoryboardDocument } from '@video-maker/timeline-core';

function renderBar(
  putStoryboard: RenderApiClient['putStoryboard'],
  storyboard: StoryboardDocument = storyboardFixture(),
  dirty = true,
) {
  const onSaved = vi.fn();
  const onDiscard = vi.fn();

  render(
    <RenderApiProvider client={{ putStoryboard } as unknown as RenderApiClient}>
      <StoryboardSaveBar
        slug="smoke-ingest"
        storyboard={storyboard}
        dirty={dirty}
        onSaved={onSaved}
        onDiscard={onDiscard}
      />
    </RenderApiProvider>,
  );

  return { onSaved, onDiscard };
}

function saveButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: /Save storyboard|Saving/ }) as HTMLButtonElement;
}

describe('StoryboardSaveBar', () => {
  it('writes the full document in a single PUT and reports the save upwards', async () => {
    const putStoryboard = vi.fn().mockResolvedValue({ slug: 'smoke-ingest', path: 'work/storyboard.json' });
    const storyboard = storyboardFixture();
    const { onSaved } = renderBar(putStoryboard, storyboard);

    fireEvent.click(saveButton());

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(storyboard));
    expect(putStoryboard).toHaveBeenCalledWith('smoke-ingest', storyboard);
  });

  it('publishes the dirty state as a data attribute for the smoke script', () => {
    renderBar(vi.fn(), storyboardFixture(), false);

    expect(screen.getByTestId('storyboard-save-bar').getAttribute('data-storyboard-dirty')).toBe(
      'false',
    );
    expect(screen.getByText('Saved')).toBeTruthy();
  });

  it('says there are unsaved changes while the document is dirty and offers to discard them', () => {
    const { onDiscard } = renderBar(vi.fn());

    expect(screen.getByText('Unsaved changes')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it('has nothing to discard on a clean document', () => {
    renderBar(vi.fn(), storyboardFixture(), false);

    expect((screen.getByRole('button', { name: 'Discard' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('stays pinned to the bottom of the scroll area as a labelled region', () => {
    renderBar(vi.fn());

    const bar = screen.getByRole('region', { name: 'Save changes' });
    expect(bar.className).toContain('sticky');
    expect(bar.className).toContain('bottom-0');
  });

  it('cannot save a clean document, so a save is always a real change', () => {
    renderBar(vi.fn(), storyboardFixture(), false);

    expect(saveButton().disabled).toBe(true);
  });

  it('blocks the save with the client mirror of the 422 written on screen', () => {
    const invalid = setSceneText(storyboardFixture(), 'scene-01', 'narration', '');
    renderBar(vi.fn(), invalid);

    expect(saveButton().disabled).toBe(true);
    expect(screen.getByTestId('storyboard-issues').textContent).toContain('scenes.0.narration');
  });

  it('shows the typed error of a rejected write and stays dirty', async () => {
    const putStoryboard = vi
      .fn()
      .mockRejectedValue(new RenderApiError('STORYBOARD_INVALID', 'does not validate', 422, null));
    const { onSaved } = renderBar(putStoryboard);

    fireEvent.click(saveButton());

    await waitFor(() => expect(screen.getByText('STORYBOARD_INVALID')).toBeTruthy());
    expect(onSaved).not.toHaveBeenCalled();
  });
});
