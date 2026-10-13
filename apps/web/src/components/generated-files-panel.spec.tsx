import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RenderApiProvider } from '../api/render-api-context';
import { RenderApiError } from '../api/render-api-error';
import { GeneratedFilesPanel } from './generated-files-panel';
import { VOICE_SCRIPT_MANIFEST_JSON, voiceDocument } from '../api/__fixtures__/voice';
import type { AssetListing, GeneratedListing } from '../api/render-api-types';
import type { RenderApiClient } from '../api/render-api-client';

const GENERATED: GeneratedListing = {
  slug: 'display-ads',
  roots: ['work/voice', 'work/producer', 'out'],
  files: [
    { path: 'work/voice/voice.wav', sizeBytes: 6_100_000, modifiedAtMs: 1, sample: false },
    { path: 'work/voice/voice.words.json', sizeBytes: 40_000, modifiedAtMs: 1, sample: false },
    { path: 'work/producer/script.txt', sizeBytes: 1_200, modifiedAtMs: 1, sample: false },
    { path: 'out/display-ads.mp4', sizeBytes: 24_000_000, modifiedAtMs: 1, sample: false },
  ],
};

function logoListing(hasAlpha: boolean | undefined): AssetListing {
  return {
    slug: 'display-ads',
    source: 'catalog',
    assets: [
      {
        path: 'raw/logo/brand.png',
        role: 'logo',
        fingerprint: { sizeBytes: 1, modifiedAtMs: 1 },
        media: {
          id: 'raw/logo/brand.png',
          kind: 'image',
          path: 'raw/logo/brand.png',
          durationMs: 0,
          probedAt: '2026-09-01T00:00:00.000Z',
          ...(hasAlpha === undefined ? {} : { hasAlpha }),
        },
      },
    ],
    probeFailures: [],
  };
}

function renderPanel(options: {
  generated?: GeneratedListing;
  assets?: AssetListing | null;
  failGenerated?: boolean;
  scriptMode?: boolean;
}) {
  const client = {
    getRenderReview: vi.fn().mockResolvedValue(null),
    listGenerated: options.failGenerated === true
      ? vi.fn().mockRejectedValue(
          new RenderApiError('PROJECT_NOT_FOUND', 'no project', 404, null),
        )
      : vi.fn().mockResolvedValue(options.generated ?? GENERATED),
    getVoice: options.scriptMode === true
      ? vi.fn().mockRejectedValue(new RenderApiError('VOICE_NOT_FOUND', 'no manifest', 404, null))
      : vi.fn().mockResolvedValue(voiceDocument()),
    getProjectFile: options.scriptMode === true
      ? vi.fn().mockResolvedValue(VOICE_SCRIPT_MANIFEST_JSON)
      : vi.fn().mockRejectedValue(new RenderApiError('ARTIFACT_NOT_FOUND', 'no script', 404, null)),
  } as unknown as RenderApiClient;

  if (options.scriptMode === true && client.listGenerated !== undefined) {
    (client.listGenerated as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...(options.generated ?? GENERATED),
      files: [...(options.generated ?? GENERATED).files, { path: 'work/voice/script-manifest.json', sizeBytes: 500, modifiedAtMs: 1, sample: false }],
    });
  }

  render(
    <RenderApiProvider client={client}>
      <GeneratedFilesPanel slug="display-ads" assets={options.assets ?? null} />
    </RenderApiProvider>,
  );
}

describe('GeneratedFilesPanel (FIX-006-001)', () => {
  it('reproduce la narración generada y dice con qué voz se hizo', async () => {
    renderPanel({});

    const audio = await screen.findByTestId('generated-narration-audio');

    expect(audio.getAttribute('src')).toBe('/api/projects/display-ads/files/work/voice/voice.wav');
    expect((await screen.findByTestId('generated-narration-voice')).textContent).toContain(
      'es_AR-daniela-high',
    );
    expect((await screen.findByTestId('generated-narration')).textContent).toContain('6.1 MB');
  });

  it('ofrece el guion del productor y el entregable', async () => {
    renderPanel({});

    expect((await screen.findByTestId('generated-script')).textContent).toContain(
      'work/producer/script.txt',
    );
    expect((await screen.findByTestId('generated-deliverable-video')).getAttribute('src')).toBe(
      '/api/projects/display-ads/files/out/display-ads.mp4',
    );
  });

  it('muestra el panel de revisión de cada entregable', async () => {
    renderPanel({});

    const panel = await screen.findByTestId('render-review');
    expect(panel.getAttribute('data-file')).toBe('out/display-ads.mp4');
  });

  it('dice que no hay nada generado cuando el motor no produjo nada', async () => {
    renderPanel({ generated: { ...GENERATED, files: [] } });

    expect((await screen.findByTestId('generated-empty')).textContent).toContain(
      'Nothing generated yet',
    );
  });

  it('avisa cuando el logo del proyecto no tiene transparencia', async () => {
    renderPanel({ assets: logoListing(false) });

    const notice = await screen.findByTestId('generated-logo-no-alpha');

    expect(notice.textContent).toContain('This logo has no transparency; it will show as a box');
  });

  it('no avisa nada cuando el logo tiene alfa o cuando el probe no opinó', async () => {
    renderPanel({ assets: logoListing(true) });

    await waitFor(() => expect(screen.getByTestId('generated-narration')).toBeTruthy());
    expect(screen.queryByTestId('generated-logo-no-alpha')).toBeNull();
  });

  it('muestra el error tipado del listado', async () => {
    renderPanel({ failGenerated: true });

    expect((await screen.findByRole('alert')).textContent).toContain('PROJECT_NOT_FOUND');
  });

  it('en modo guion lee la voz del script-manifest, no del manifest de escenas', async () => {
    renderPanel({ scriptMode: true });

    expect((await screen.findByTestId('generated-narration-voice')).textContent).toContain(
      'es_AR-daniela-high',
    );
  });

  it('nunca pide el script-manifest si el listado no lo tiene, para no generar un 404 esperado en un proyecto nuevo', async () => {
    const client = {
      listGenerated: vi.fn().mockResolvedValue({ ...GENERATED, files: [] }),
      getVoice: vi.fn().mockResolvedValue(voiceDocument()),
      getProjectFile: vi.fn().mockRejectedValue(new RenderApiError('ARTIFACT_NOT_FOUND', 'no script', 404, null)),
    } as unknown as RenderApiClient;

    render(
      <RenderApiProvider client={client}>
        <GeneratedFilesPanel slug="display-ads" assets={null} />
      </RenderApiProvider>,
    );

    await waitFor(() => expect(client.listGenerated).toHaveBeenCalled());
    expect(await screen.findByTestId('generated-empty')).toBeTruthy();
    expect(client.getProjectFile).not.toHaveBeenCalled();
  });

  it('nunca pide el documento de voz si el listado no tiene work/voice/voice.wav, para no generar un 404 esperado en un proyecto nuevo', async () => {
    const client = {
      listGenerated: vi.fn().mockResolvedValue({ ...GENERATED, files: [] }),
      getVoice: vi.fn().mockResolvedValue(voiceDocument()),
      getProjectFile: vi.fn().mockRejectedValue(new RenderApiError('ARTIFACT_NOT_FOUND', 'no script', 404, null)),
    } as unknown as RenderApiClient;

    render(
      <RenderApiProvider client={client}>
        <GeneratedFilesPanel slug="display-ads" assets={null} />
      </RenderApiProvider>,
    );

    expect(await screen.findByTestId('generated-empty')).toBeTruthy();
    expect(client.getVoice).not.toHaveBeenCalled();
  });

  it('marca la muestra, la reproduce y no le ofrece revisión', async () => {
    renderPanel({
      generated: {
        ...GENERATED,
        files: [
          ...GENERATED.files,
          { path: 'out/job-0009.sample.mp4', sizeBytes: 2_000_000, modifiedAtMs: 2, sample: true },
        ],
      },
    });

    const videos = await screen.findAllByTestId('generated-deliverable-video');
    expect(videos.map((video) => video.getAttribute('src'))).toContain(
      '/api/projects/display-ads/files/out/job-0009.sample.mp4',
    );
    expect(screen.getAllByText('Sample')).toHaveLength(1);
    expect(screen.getAllByTestId('render-review').length).toBe(1);
  });

  it('trata como muestra un archivo de nombre normal cuando el render lo marca', async () => {
    renderPanel({
      generated: {
        ...GENERATED,
        files: [
          ...GENERATED.files,
          { path: 'out/job-0010.mp4', sizeBytes: 2_000_000, modifiedAtMs: 2, sample: true },
        ],
      },
    });

    await screen.findAllByTestId('generated-deliverable-video');
    expect(screen.getAllByText('Sample')).toHaveLength(1);
    expect(screen.getAllByTestId('render-review').length).toBe(1);
  });
});
