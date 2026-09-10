import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RenderApiProvider } from '../api/render-api-context';
import { RenderApiError } from '../api/render-api-error';
import { StoryboardPromptSheet } from './storyboard-prompt-sheet';
import type { RenderApiClient } from '../api/render-api-client';

const SHEET = '# CHARACTERS\n\n01. Nina — mustard hoodie\n\n# SCENES\n\n01. upload — a prompt\n';

function withClipboard(value: unknown): void {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true });
}

afterEach(() => {
  withClipboard(undefined);
});

function renderSheet(getStoryboardPrompts: RenderApiClient['getStoryboardPrompts'], dirty = false) {
  render(
    <RenderApiProvider client={{ getStoryboardPrompts } as unknown as RenderApiClient}>
      <StoryboardPromptSheet slug="smoke-ingest" dirty={dirty} />
    </RenderApiProvider>,
  );
}

describe('StoryboardPromptSheet', () => {
  it('explains where the prompts are pasted and how the numbering is used', () => {
    renderSheet(vi.fn());

    expect(screen.getByText(/Meta AI or Google Flow/)).toBeTruthy();
    expect(screen.getByText(/01.mp4, 03.png/)).toBeTruthy();
  });

  it('copies the sheet exactly as the service emitted it, without rebuilding it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    withClipboard({ writeText });
    renderSheet(vi.fn().mockResolvedValue(SHEET));

    fireEvent.click(screen.getByRole('button', { name: 'Copy prompts' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(SHEET));
    expect(screen.getByText('Copied to the clipboard.')).toBeTruthy();
  });

  it('falls back to showing the sheet when the browser refuses the clipboard', async () => {
    withClipboard(undefined);
    renderSheet(vi.fn().mockResolvedValue(SHEET));

    fireEvent.click(screen.getByRole('button', { name: 'Copy prompts' }));

    await waitFor(() => expect(screen.getByText(/refused the clipboard/)).toBeTruthy());
    expect(screen.getByTestId('storyboard-prompt-text').textContent).toBe(SHEET);
  });

  it('shows the numbered sheet on screen without copying anything', async () => {
    const writeText = vi.fn();
    withClipboard({ writeText });
    renderSheet(vi.fn().mockResolvedValue(SHEET));

    fireEvent.click(screen.getByRole('button', { name: 'Show prompts' }));

    await waitFor(() => expect(screen.getByTestId('storyboard-prompt-text')).toBeTruthy());
    expect(writeText).not.toHaveBeenCalled();
  });

  it('warns that the sheet comes from the saved storyboard while there are unsaved changes', () => {
    renderSheet(vi.fn(), true);

    expect(screen.getByText(/save your changes first/)).toBeTruthy();
  });

  it('shows the typed error when the project has no storyboard to export', async () => {
    renderSheet(
      vi.fn().mockRejectedValue(new RenderApiError('STORYBOARD_NOT_FOUND', 'nothing', 404, null)),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show prompts' }));

    await waitFor(() => expect(screen.getByText('STORYBOARD_NOT_FOUND')).toBeTruthy());
    expect(screen.queryByTestId('storyboard-prompt-text')).toBeNull();
  });
});
