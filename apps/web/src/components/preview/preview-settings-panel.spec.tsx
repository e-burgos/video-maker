import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { editableTimelineFixture } from '../../api/__fixtures__/editable-timeline';
import { RenderApiProvider } from '../../api/render-api-context';
import type { RenderApiClient } from '../../api/render-api-client';
import { PreviewSettingsPanel } from './preview-settings-panel';

function renderPanel() {
  const client = {
    listAssets: vi
      .fn()
      .mockResolvedValue({ slug: 'smoke-ingest', source: 'catalog', assets: [], probeFailures: [] }),
  } as unknown as RenderApiClient;

  render(
    <RenderApiProvider client={client}>
      <MemoryRouter>
        <PreviewSettingsPanel slug="smoke-ingest" draft={editableTimelineFixture()} brandTheme={null} dispatch={vi.fn()} />
      </MemoryRouter>
    </RenderApiProvider>,
  );
}

function trigger(sectionId: string): HTMLElement {
  return screen.getByTestId(`preview-section-${sectionId}`).querySelector('button[aria-expanded]') as HTMLElement;
}

describe('PreviewSettingsPanel', () => {
  it('starts with every section collapsed and a summary visible for each', () => {
    renderPanel();

    ['output', 'logo', 'music', 'aroll', 'broll', 'captions', 'textOverlays'].forEach((id) => {
      expect(trigger(id).getAttribute('aria-expanded')).toBe('false');
      expect(screen.getByTestId(`preview-summary-${id}`).textContent?.length).toBeGreaterThan(0);
    });
  });

  it('opens one section at a time', () => {
    renderPanel();

    fireEvent.click(trigger('music'));
    expect(trigger('music').getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(trigger('logo'));
    expect(trigger('logo').getAttribute('aria-expanded')).toBe('true');
    expect(trigger('music').getAttribute('aria-expanded')).toBe('false');
  });

  it('collapses the open section when its header is clicked again', () => {
    renderPanel();

    fireEvent.click(trigger('captions'));
    fireEvent.click(trigger('captions'));

    expect(trigger('captions').getAttribute('aria-expanded')).toBe('false');
  });
});
