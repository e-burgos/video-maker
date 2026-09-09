import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { previewTimelineFixture } from '../api/__fixtures__/timeline';
import { RenderApiError } from '../api/render-api-error';
import { RenderApiProvider } from '../api/render-api-context';
import type { RenderApiClient } from '../api/render-api-client';

vi.mock('../components/timeline-player', async () => {
  const { createElement } = await import('react');

  return {
    TimelinePlayer: (props: {
      timeline: {
        format: { preset: string; width: number; height: number };
        safeZone?: { top: number };
        assets: readonly { path: string }[];
      };
    }) =>
      createElement('div', {
        'data-testid': 'timeline-player',
        'data-preset': props.timeline.format.preset,
        'data-canvas': `${props.timeline.format.width}x${props.timeline.format.height}`,
        'data-safe-top': String(props.timeline.safeZone?.top),
        'data-first-asset': props.timeline.assets[0]?.path ?? '',
      }),
  };
});

const { ProjectPreviewPage } = await import('./project-preview-page');

function renderPage(client: Partial<RenderApiClient>) {
  render(
    <RenderApiProvider client={client as RenderApiClient}>
      <MemoryRouter initialEntries={['/projects/smoke-ingest/preview']}>
        <Routes>
          <Route path="/projects/:slug/preview" element={<ProjectPreviewPage />} />
        </Routes>
      </MemoryRouter>
    </RenderApiProvider>,
  );
}

describe('ProjectPreviewPage', () => {
  it('lee la timeline persistida del proyecto por EP-007', async () => {
    const getTimeline = vi.fn().mockResolvedValue(previewTimelineFixture());
    renderPage({ getTimeline });

    await waitFor(() => expect(screen.getByTestId('timeline-player')).toBeTruthy());
    expect(getTimeline).toHaveBeenCalledWith('smoke-ingest');
  });

  it('resuelve los assets del player a URLs same-origin de EP-011', async () => {
    renderPage({ getTimeline: vi.fn().mockResolvedValue(previewTimelineFixture()) });

    await waitFor(() => expect(screen.getByTestId('timeline-player')).toBeTruthy());
    expect(screen.getByTestId('timeline-player').getAttribute('data-first-asset')).toBe(
      `${window.location.origin}/api/projects/smoke-ingest/files/raw/aroll/clip%2001.mp4`,
    );
  });

  it('arranca en el formato del documento y resume la timeline en pantalla', async () => {
    renderPage({ getTimeline: vi.fn().mockResolvedValue(previewTimelineFixture()) });

    await waitFor(() => expect(screen.getByTestId('timeline-player')).toBeTruthy());
    expect(screen.getByTestId('timeline-player').getAttribute('data-preset')).toBe('reels-9x16');
    expect(screen.getByTestId('preview-canvas').textContent).toBe('1080×1920 @ 30 fps');
    expect(screen.getByTestId('preview-duration').textContent).toBe('120 frames · 4.00 s');
    expect(screen.getByTestId('preview-tracks').textContent).toBe(
      '1 a-roll · 0 b-roll · 1 voice · 1 music · 1 captions',
    );
  });

  it('el selector de formato cambia lienzo y safe zone sin volver a pedir la timeline', async () => {
    const getTimeline = vi.fn().mockResolvedValue(previewTimelineFixture());
    renderPage({ getTimeline });

    await waitFor(() => expect(screen.getByTestId('timeline-player')).toBeTruthy());
    expect(screen.getByTestId('timeline-player').getAttribute('data-safe-top')).toBe('220');

    fireEvent.click(screen.getByRole('button', { name: '16:9' }));

    await waitFor(() =>
      expect(screen.getByTestId('timeline-player').getAttribute('data-preset')).toBe(
        'youtube-16x9',
      ),
    );
    expect(screen.getByTestId('timeline-player').getAttribute('data-canvas')).toBe('1920x1080');
    expect(screen.getByTestId('timeline-player').getAttribute('data-safe-top')).toBe('60');
    expect(screen.getByRole('button', { name: '16:9' }).getAttribute('aria-pressed')).toBe('true');
    expect(getTimeline).toHaveBeenCalledTimes(1);
  });

  it('muestra el code del servicio cuando el proyecto no tiene timeline y no monta el player', async () => {
    renderPage({
      getTimeline: vi
        .fn()
        .mockRejectedValue(
          new RenderApiError('TIMELINE_NOT_FOUND', 'no timeline stored', 404, null),
        ),
    });

    await waitFor(() => expect(screen.getByText(/TIMELINE_NOT_FOUND/)).toBeTruthy());
    expect(screen.queryByTestId('timeline-player')).toBeNull();
  });
});
