import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { storyboardFixture } from '../api/__fixtures__/storyboard';
import {
  VOICE_MODELS,
  VOICE_SCRIPT_MANIFEST_JSON,
  healthyVoiceService,
  voiceDocument,
  voiceJob,
  voiceTrack,
} from '../api/__fixtures__/voice';
import { RenderApiError } from '../api/render-api-error';
import { RenderApiProvider } from '../api/render-api-context';
import { VoicePage, recordedTakes } from './voice-page';
import type { RenderApiClient } from '../api/render-api-client';
import type { AssetListing } from '../api/render-api-types';

function assetListing(paths: string[]): AssetListing {
  return {
    slug: 'smoke-ingest',
    source: 'catalog',
    assets: paths.map((path) => ({
      path,
      role: path.startsWith('raw/voice/') ? 'voice' : 'aroll',
      fingerprint: { sizeBytes: 1, modifiedAtMs: 1 },
      media: null,
    })),
    probeFailures: [],
  };
}

function renderPage(client: Partial<RenderApiClient>) {
  const withDefaults: Partial<RenderApiClient> = {
    getHealth: vi.fn().mockResolvedValue(healthyVoiceService()),
    listVoices: vi.fn().mockResolvedValue(VOICE_MODELS),
    getStoryboard: vi.fn().mockResolvedValue(storyboardFixture()),
    listAssets: vi.fn().mockResolvedValue(assetListing(['raw/voice/take-01.wav'])),
    getRenderJob: vi.fn().mockResolvedValue(voiceJob({ state: 'queued', progress: null })),
    getProjectFile: vi
      .fn()
      .mockRejectedValue(new RenderApiError('ARTIFACT_NOT_FOUND', 'no manifest', 404, null)),
    ...client,
  };

  render(
    <RenderApiProvider client={withDefaults as RenderApiClient}>
      <MemoryRouter initialEntries={['/projects/smoke-ingest/voice']}>
        <Routes>
          <Route path="/projects/:slug/voice" element={<VoicePage />} />
        </Routes>
      </MemoryRouter>
    </RenderApiProvider>,
  );

  return withDefaults;
}

describe('recordedTakes', () => {
  it('keeps only the file names of the voice role, sorted', () => {
    expect(
      recordedTakes(assetListing(['raw/aroll/clip.mp4', 'raw/voice/b.wav', 'raw/voice/a.wav'])),
    ).toEqual(['a.wav', 'b.wav']);
    expect(recordedTakes(null)).toEqual([]);
  });
});

describe('VoicePage', () => {
  it('offers an actionable empty state when the project has no manifest yet', async () => {
    renderPage({
      getVoice: vi
        .fn()
        .mockRejectedValue(new RenderApiError('VOICE_NOT_FOUND', 'no manifest', 404, null)),
    });

    await waitFor(() => expect(screen.getByTestId('voice-empty-state')).toBeDefined());
    expect(screen.getByTestId('voice-trigger')).toBeDefined();
  });

  it('shows any other read failure with its code and a retry', async () => {
    renderPage({
      getVoice: vi
        .fn()
        .mockRejectedValue(new RenderApiError('VOICE_INVALID', 'does not validate', 422, null)),
    });

    await waitFor(() => expect(screen.getByText(/VOICE_INVALID/)).toBeDefined());
    expect(screen.queryByTestId('voice-empty-state')).toBeNull();
  });

  it('renders one player per track with the narration and the estimate of its scene', async () => {
    renderPage({ getVoice: vi.fn().mockResolvedValue(voiceDocument()) });

    await waitFor(() => expect(screen.getByTestId('voice-scene-scene-01')).toBeDefined());
    expect(screen.getByLabelText('Voice track of scene-01')).toBeDefined();
    expect(screen.getByLabelText('Voice track of scene-02')).toBeDefined();
    expect(screen.getByText('Hay tres comandos que te devuelven una hora por semana.')).toBeDefined();
    expect(screen.getByTestId('voice-duration-scene-01').textContent).toContain('estimated 4.20 s');
    expect(screen.getByTestId('voice-duration-scene-01').textContent).toContain('real 3.10 s');
  });

  it('still plays the tracks when the storyboard cannot be read, without an estimate', async () => {
    renderPage({
      getVoice: vi.fn().mockResolvedValue(voiceDocument()),
      getStoryboard: vi
        .fn()
        .mockRejectedValue(new RenderApiError('STORYBOARD_NOT_FOUND', 'gone', 404, null)),
    });

    await waitFor(() => expect(screen.getByTestId('voice-scene-scene-01')).toBeDefined());
    expect(screen.getByTestId('voice-duration-scene-01').textContent).toContain(
      'no estimate in the storyboard',
    );
  });

  it('flags the stale scene the manifest reported and regenerates only that one', async () => {
    const createVoiceJob = vi.fn().mockResolvedValue(voiceJob());
    renderPage({ getVoice: vi.fn().mockResolvedValue(voiceDocument()), createVoiceJob });

    await waitFor(() => expect(screen.getByTestId('voice-stale-scene-02')).toBeDefined());
    expect(screen.queryByTestId('voice-stale-scene-01')).toBeNull();

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Regenerate this scene' })[1] as HTMLButtonElement,
    );

    await waitFor(() =>
      expect(createVoiceJob).toHaveBeenCalledWith('smoke-ingest', {
        voiceId: 'es_AR-daniela-high',
        sceneIds: ['scene-02'],
        overwrite: true,
      }),
    );
    await waitFor(() => expect(screen.getByTestId('voice-job-panel')).toBeDefined());
  });

  it('regenerates an uploaded scene with the service default voice, not a null it invented', async () => {
    const createVoiceJob = vi.fn().mockResolvedValue(voiceJob());
    const uploaded = voiceDocument({
      manifest: {
        schemaVersion: 1,
        storyboardId: 'sb',
        language: 'es-AR',
        tracks: [voiceTrack({ source: 'uploaded', voiceId: null })],
      },
      scenes: [{ sceneId: 'scene-01', index: 1, source: 'uploaded', stale: false }],
    });
    renderPage({ getVoice: vi.fn().mockResolvedValue(uploaded), createVoiceJob });

    await waitFor(() => expect(screen.getByTestId('voice-scene-scene-01')).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate this scene' }));

    await waitFor(() =>
      expect(createVoiceJob).toHaveBeenCalledWith('smoke-ingest', {
        voiceId: null,
        sceneIds: ['scene-01'],
        overwrite: true,
      }),
    );
  });

  it('shows the code when the regeneration is refused at request time', async () => {
    renderPage({
      getVoice: vi.fn().mockResolvedValue(voiceDocument()),
      createVoiceJob: vi
        .fn()
        .mockRejectedValue(new RenderApiError('VOICE_SCENE_NOT_FOUND', 'gone', 404, null)),
    });

    await waitFor(() => expect(screen.getByTestId('voice-scene-scene-01')).toBeDefined());
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Regenerate this scene' })[0] as HTMLButtonElement,
    );

    await waitFor(() => expect(screen.getByText(/VOICE_SCENE_NOT_FOUND/)).toBeDefined());
    expect(screen.queryByTestId('voice-job-panel')).toBeNull();
  });

  it('offers the takes already under raw/voice/ to every scene', async () => {
    renderPage({
      getVoice: vi.fn().mockResolvedValue(voiceDocument()),
      listAssets: vi
        .fn()
        .mockResolvedValue(assetListing(['raw/aroll/clip.mp4', 'raw/voice/take-07.wav'])),
    });

    await waitFor(() => expect(screen.getByTestId('voice-scene-scene-01')).toBeDefined());
    const select = screen.getByLabelText('Recorded take for scene-01') as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.value)).toEqual(['take-07.wav']);
  });

  it('reloads the manifest after a take is attached to a scene', async () => {
    const getVoice = vi.fn().mockResolvedValue(voiceDocument());
    const attachVoiceTake = vi.fn().mockResolvedValue({
      slug: 'smoke-ingest',
      path: 'work/voice/manifest.json',
      track: voiceTrack({ source: 'uploaded', voiceId: null }),
    });
    renderPage({ getVoice, attachVoiceTake });

    await waitFor(() => expect(screen.getByTestId('voice-scene-scene-01')).toBeDefined());
    const callsBefore = getVoice.mock.calls.length;

    fireEvent.click(screen.getAllByRole('button', { name: 'Use this take' })[0] as HTMLButtonElement);

    await waitFor(() =>
      expect(attachVoiceTake).toHaveBeenCalledWith('smoke-ingest', 'scene-01', 'take-01.wav'),
    );
    await waitFor(() => expect(getVoice.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it('links back to the storyboard, which is where the narration is edited', async () => {
    renderPage({ getVoice: vi.fn().mockResolvedValue(voiceDocument()) });

    await waitFor(() => expect(screen.getByTestId('voice-scene-scene-01')).toBeDefined());
    expect(
      (screen.getByRole('link', { name: 'storyboard page' }) as HTMLAnchorElement).getAttribute(
        'href',
      ),
    ).toBe('/projects/smoke-ingest/storyboard');
  });
});

describe('VoicePage — modo guion (FIX-009-003)', () => {
  const NO_STORYBOARD = new RenderApiError('STORYBOARD_NOT_FOUND', 'nothing yet', 404, null);
  const NO_VOICE_MANIFEST = new RenderApiError('VOICE_NOT_FOUND', 'nothing yet', 404, null);

  function renderScriptMode(overrides: Partial<RenderApiClient> = {}) {
    return renderPage({
      getStoryboard: vi.fn().mockRejectedValue(NO_STORYBOARD),
      getVoice: vi.fn().mockRejectedValue(NO_VOICE_MANIFEST),
      getProjectFile: vi.fn().mockResolvedValue(VOICE_SCRIPT_MANIFEST_JSON),
      ...overrides,
    });
  }

  it('sin storyboard pero con script-manifest.json muestra el guion en vez del estado vacío', async () => {
    renderScriptMode();

    expect(await screen.findByTestId('voice-script-panel')).toBeTruthy();
    expect(screen.getAllByTestId('voice-script-line')).toHaveLength(2);
    expect(screen.queryByTestId('voice-empty-state')).toBeNull();
  });

  it('lee el manifest del guion por el endpoint de artefactos', async () => {
    const client = renderScriptMode();

    await waitFor(() =>
      expect(client.getProjectFile).toHaveBeenCalledWith(
        'smoke-ingest',
        'work/voice/script-manifest.json',
      ),
    );
  });

  it('el botón regenera desde el guion del productor con la voz elegida', async () => {
    const createVoiceJob = vi.fn().mockResolvedValue(voiceJob());
    renderScriptMode({ createVoiceJob });

    const button = await screen.findByRole('button', {
      name: 'Regenerate with the selected voice',
    });
    fireEvent.click(button);

    await waitFor(() =>
      expect(createVoiceJob).toHaveBeenCalledWith('smoke-ingest', {
        voiceId: 'es_AR-daniela-high',
        sceneIds: null,
        overwrite: false,
        scriptPath: 'work/producer/script.txt',
      }),
    );
  });

  it('avisa que después hay que volver a montar y renderizar', async () => {
    renderScriptMode();

    expect(
      await screen.findByText(
        'After regenerating you have to run the montage and the render again.',
      ),
    ).toBeTruthy();
  });

  it('sin storyboard y sin manifest el estado vacío lleva al productor', async () => {
    renderPage({
      getStoryboard: vi.fn().mockRejectedValue(NO_STORYBOARD),
      getVoice: vi.fn().mockRejectedValue(NO_VOICE_MANIFEST),
    });

    const empty = await screen.findByTestId('voice-empty-state');

    expect(empty.textContent).toContain('Ask the producer for a narration');
    expect(screen.queryByTestId('voice-script-panel')).toBeNull();
  });

  it('con storyboard sigue en modo escenas aunque haya un manifest de guion viejo', async () => {
    renderPage({
      getVoice: vi.fn().mockResolvedValue(voiceDocument()),
      getProjectFile: vi.fn().mockResolvedValue(VOICE_SCRIPT_MANIFEST_JSON),
    });

    await waitFor(() => expect(screen.getByText(/tracks/u)).toBeTruthy());
    expect(screen.queryByTestId('voice-script-panel')).toBeNull();
  });
});
