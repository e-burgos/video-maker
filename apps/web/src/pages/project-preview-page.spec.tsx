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
        tracks: {
          aroll: readonly { trimStartMs: number }[];
          captions: readonly { words: readonly { text: string }[] }[];
        };
        audioMix: { automation: readonly { frame: number; gainDb: number }[] };
      };
    }) =>
      createElement('div', {
        'data-testid': 'timeline-player',
        'data-preset': props.timeline.format.preset,
        'data-canvas': `${props.timeline.format.width}x${props.timeline.format.height}`,
        'data-composition-width': String(props.timeline.format.width),
        'data-composition-height': String(props.timeline.format.height),
        'data-safe-top': String(props.timeline.safeZone?.top),
        'data-first-asset': props.timeline.assets[0]?.path ?? '',
        'data-aroll-trim-0': String(props.timeline.tracks.aroll[0]?.trimStartMs),
        'data-first-caption-word': props.timeline.tracks.captions[0]?.words[0]?.text ?? '',
        'data-automation': JSON.stringify(props.timeline.audioMix.automation),
      }),
  };
});

const { ProjectPreviewPage } = await import('./project-preview-page');

function renderPage(client: Partial<RenderApiClient>) {
  const merged: Partial<RenderApiClient> = {
    listRenderJobs: vi.fn().mockResolvedValue({ slug: 'smoke-ingest', jobs: [] }),
    ...client,
  };

  render(
    <RenderApiProvider client={merged as RenderApiClient}>
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

  it('tras una accion de trim, el TimelinePlayer recibe el draft (no el saved) y no se emite ningun request de escritura (T-07 / CA-204)', async () => {
    const getTimeline = vi.fn().mockResolvedValue(previewTimelineFixture());
    const putTimeline = vi.fn();
    renderPage({ getTimeline, putTimeline });

    await waitFor(() => expect(screen.getByTestId('timeline-player')).toBeTruthy());
    expect(screen.getByTestId('timeline-player').getAttribute('data-aroll-trim-0')).toBe('0');

    fireEvent.change(screen.getByLabelText('Trim start for aroll-0001'), {
      target: { value: '480' },
    });

    await waitFor(() =>
      expect(screen.getByTestId('timeline-player').getAttribute('data-aroll-trim-0')).toBe('480'),
    );
    expect(putTimeline).not.toHaveBeenCalled();
  });

  it('editado el texto de una palabra, el timeline que llega al Player lo trae, sin request (T-12 / CA-208)', async () => {
    const getTimeline = vi.fn().mockResolvedValue(previewTimelineFixture());
    const putTimeline = vi.fn();
    renderPage({ getTimeline, putTimeline });

    await waitFor(() => expect(screen.getByTestId('timeline-player')).toBeTruthy());
    expect(screen.getByTestId('timeline-player').getAttribute('data-first-caption-word')).toBe(
      'preview',
    );

    fireEvent.change(screen.getByLabelText('Word 1 of caption-0001'), {
      target: { value: 'edited' },
    });

    await waitFor(() =>
      expect(screen.getByTestId('timeline-player').getAttribute('data-first-caption-word')).toBe(
        'edited',
      ),
    );
    expect(putTimeline).not.toHaveBeenCalled();
  });

  // CA-211's literal formula (volume === 10^(baseGainDb/20) on the <audio> element) is superseded
  // by CA-210's own measured finding: the real volume is volumeAtFrame(automation, frame), not a
  // scalar of the level — asserting the literal formula would encode a known-wrong expectation
  // (declared divergence, cycle-03 cycle.json CA-211 verification note).
  it(
    'tras cambiar los niveles de musica en MusicMixEditor, la automation reescrita llega al ' +
      'TimelinePlayer, sin request (CA-211)',
    async () => {
      const getTimeline = vi.fn().mockResolvedValue(previewTimelineFixture());
      const putTimeline = vi.fn();
      renderPage({ getTimeline, putTimeline });

      await waitFor(() => expect(screen.getByTestId('timeline-player')).toBeTruthy());
      expect(screen.getByTestId('timeline-player').getAttribute('data-automation')).toBe(
        JSON.stringify([{ frame: 0, gainDb: -24 }]),
      );

      fireEvent.change(screen.getByLabelText('Base level (dB)'), { target: { value: '-6' } });
      fireEvent.change(screen.getByLabelText('Ducked level (dB)'), { target: { value: '-30' } });

      await waitFor(() =>
        expect(screen.getByTestId('timeline-player').getAttribute('data-automation')).toBe(
          JSON.stringify([{ frame: 0, gainDb: -30 }]),
        ),
      );
      expect(putTimeline).not.toHaveBeenCalled();
    },
  );

  it('cambiando el preset persistido, la composicion del Player pasa a la del preset (T-19 / CA-214)', async () => {
    renderPage({ getTimeline: vi.fn().mockResolvedValue(previewTimelineFixture()) });

    await waitFor(() => expect(screen.getByTestId('timeline-player')).toBeTruthy());
    expect(screen.getByTestId('timeline-player').getAttribute('data-composition-width')).toBe('1080');
    expect(screen.getByTestId('timeline-player').getAttribute('data-composition-height')).toBe('1920');

    fireEvent.change(screen.getByLabelText('Output preset'), { target: { value: 'youtube-16x9' } });

    await waitFor(() =>
      expect(screen.getByTestId('timeline-player').getAttribute('data-composition-width')).toBe(
        '1920',
      ),
    );
    expect(screen.getByTestId('timeline-player').getAttribute('data-composition-height')).toBe('1080');
  });

  it('los dos selectores de formato conviven con copy en ingles distinguible (T-21 / CA-215)', async () => {
    renderPage({ getTimeline: vi.fn().mockResolvedValue(previewTimelineFixture()) });

    await waitFor(() => expect(screen.getByTestId('timeline-player')).toBeTruthy());

    expect(screen.getByText('preview only — nothing is persisted')).toBeTruthy();
    expect(screen.getByText('Output preset — saved with the timeline')).toBeTruthy();
  });

  it('tras un fallo de guardado, el draft conserva la edicion y dirty sigue true; el code se muestra por ErrorNotice (T-26 / CA-219)', async () => {
    const getTimeline = vi.fn().mockResolvedValue(previewTimelineFixture());
    const putTimeline = vi
      .fn()
      .mockRejectedValue(
        new RenderApiError('TIMELINE_INVALID', 'The document failed validation.', 422, null),
      );
    renderPage({ getTimeline, putTimeline });

    await waitFor(() => expect(screen.getByTestId('timeline-player')).toBeTruthy());

    fireEvent.change(screen.getByLabelText('Trim start for aroll-0001'), {
      target: { value: '480' },
    });
    await waitFor(() =>
      expect(screen.getByTestId('timeline-player').getAttribute('data-aroll-trim-0')).toBe('480'),
    );
    expect(screen.getByTestId('timeline-save-bar').getAttribute('data-timeline-dirty')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('TIMELINE_INVALID'));
    expect(screen.getByTestId('timeline-player').getAttribute('data-aroll-trim-0')).toBe('480');
    expect(screen.getByTestId('timeline-save-bar').getAttribute('data-timeline-dirty')).toBe('true');
  });

  it('un issue render-blocking aparece en la lista de issues y el boton de guardar sigue habilitado (T-09 integracion / APR-01)', async () => {
    const getTimeline = vi.fn().mockResolvedValue(previewTimelineFixture());
    renderPage({ getTimeline });

    await waitFor(() => expect(screen.getByTestId('timeline-player')).toBeTruthy());

    fireEvent.change(screen.getByLabelText('Duration for aroll-0001'), { target: { value: '1000' } });

    await waitFor(() => expect(screen.getAllByText('CLIP_EXCEEDS_ASSET').length).toBeGreaterThan(0));
    expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(false);
  });

  it('el job creado por RenderTrigger queda seleccionado y aparece en RenderJobPanel (§6.3)', async () => {
    const getTimeline = vi.fn().mockResolvedValue(previewTimelineFixture());
    const job = {
      id: 'job-0001',
      slug: 'smoke-ingest',
      state: 'queued' as const,
      createdAt: '2026-09-09T10:00:00.000Z',
      startedAt: null,
      finishedAt: null,
      progress: null,
      report: null,
      error: null,
    };
    const createRenderJob = vi.fn().mockResolvedValue(job);
    const getRenderJob = vi.fn().mockResolvedValue(job);
    renderPage({ getTimeline, createRenderJob, getRenderJob });

    await waitFor(() => expect(screen.getByTestId('timeline-player')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Render' }));

    await waitFor(() => expect(screen.getByTestId('render-job-panel')).toBeTruthy());
    expect(screen.getByTestId('render-job-panel').textContent).toContain('job-0001');
  });

  it.each([
    ['PROJECT_NOT_FOUND', 404],
    ['TIMELINE_NOT_FOUND', 404],
    ['TIMELINE_INVALID', 422],
  ])(
    'EP-012 %s no agrega ninguna fila al listado y muestra su code (T-31 integracion)',
    async (code, status) => {
      const getTimeline = vi.fn().mockResolvedValue(previewTimelineFixture());
      const listRenderJobs = vi.fn().mockResolvedValue({ slug: 'smoke-ingest', jobs: [] });
      const createRenderJob = vi
        .fn()
        .mockRejectedValue(new RenderApiError(code, `${code} happened.`, status, null));
      renderPage({ getTimeline, listRenderJobs, createRenderJob });

      await waitFor(() => expect(screen.getByTestId('timeline-player')).toBeTruthy());
      await waitFor(() => expect(screen.getByText('No render jobs yet.')).toBeTruthy());

      fireEvent.click(screen.getByRole('button', { name: 'Render' }));

      await waitFor(() => expect(screen.getAllByText(code).length).toBeGreaterThan(0));
      expect(screen.queryByRole('table')).toBeNull();
      expect(screen.getByText('No render jobs yet.')).toBeTruthy();
    },
  );
});
