import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RenderApiProvider } from '../api/render-api-context';
import { RenderApiError } from '../api/render-api-error';
import { ServiceHealthBadge } from './service-health-badge';
import type { RenderApiClient } from '../api/render-api-client';
import type { ServiceHealth } from '../api/render-api-types';

function health(overrides: Partial<ServiceHealth> = {}): ServiceHealth {
  return {
    status: 'ok',
    service: 'render-api',
    cycle: 3,
    time: '2026-09-09T00:00:00.000Z',
    engine: [
      { name: 'media-local', loaded: true },
      { name: 'composition-remotion/render', loaded: true },
    ],
    binaries: [
      { name: 'ffmpeg', envVar: 'FFMPEG_PATH', resolved: true },
      { name: 'ffprobe', envVar: 'FFPROBE_PATH', resolved: true },
      { name: 'whisperCli', envVar: 'WHISPER_CPP_PATH', resolved: true },
      { name: 'whisperModel', envVar: 'WHISPER_MODEL_PATH', resolved: true },
      { name: 'piperCli', envVar: 'PIPER_PATH', resolved: true },
      { name: 'piperModel', envVar: 'PIPER_MODEL_PATH', resolved: true },
    ],
    capabilities: {
      renderPipeline: true,
      assetStore: true,
      jobQueue: true,
      montageQueue: true,
      storyboardQueue: true,
      voiceQueue: true,
    },
    jobs: { running: 0, queued: 0 },
    ...overrides,
  };
}

function clientWith(getHealth: RenderApiClient['getHealth']): RenderApiClient {
  return {
    getHealth,
    listProjects: vi.fn(),
    createProject: vi.fn(),
    getProject: vi.fn(),
    listAssets: vi.fn(),
    uploadAsset: vi.fn(),
  } as unknown as RenderApiClient;
}

function renderBadge(client: RenderApiClient) {
  return render(
    <RenderApiProvider client={client}>
      <ServiceHealthBadge />
    </RenderApiProvider>,
  );
}

describe('ServiceHealthBadge', () => {
  it('reports the healthy service with its cycle', async () => {
    renderBadge(clientWith(() => Promise.resolve(health())));

    await waitFor(() =>
      expect(screen.getByTestId('service-health-label').textContent).toBe('service ok · cycle 3'),
    );
  });

  it('names the engine module and the binary that are missing when degraded', async () => {
    renderBadge(
      clientWith(() =>
        Promise.resolve(
          health({
            status: 'degraded',
            engine: [{ name: 'composition-remotion/render', loaded: false }],
            binaries: [{ name: 'ffprobe', envVar: 'FFPROBE_PATH', resolved: false }],
          }),
        ),
      ),
    );

    await waitFor(() =>
      expect(screen.getByTestId('service-health-label').textContent).toBe(
        'service degraded: composition-remotion/render, ffprobe',
      ),
    );
  });

  it('reports the service as unreachable with the transport code', async () => {
    renderBadge(
      clientWith(() =>
        Promise.reject(new RenderApiError('SERVICE_UNREACHABLE', 'down', null, null)),
      ),
    );

    await waitFor(() =>
      expect(screen.getByTestId('service-health-label').textContent).toBe(
        'service unreachable (SERVICE_UNREACHABLE)',
      ),
    );
  });

  it('re-checks the service when the badge is clicked', async () => {
    const getHealth = vi
      .fn()
      .mockResolvedValueOnce(health({ status: 'degraded', engine: [{ name: 'ffmpeg', loaded: false }], binaries: [] }))
      .mockResolvedValueOnce(health());
    renderBadge(clientWith(getHealth));

    await waitFor(() =>
      expect(screen.getByTestId('service-health-label').textContent).toContain('degraded'),
    );
    fireEvent.click(screen.getByTitle('Re-check the render service'));
    await waitFor(() =>
      expect(screen.getByTestId('service-health-label').textContent).toBe('service ok · cycle 3'),
    );
  });

  it('lists the six media binaries with their env var and resolution state (US-2-007, US-09-012)', async () => {
    renderBadge(clientWith(() => Promise.resolve(health())));

    await waitFor(() => expect(screen.getByTestId('service-health-binaries')).toBeTruthy());
    const rows = Array.from(screen.getByTestId('service-health-binaries').children).map(
      (row) => row.textContent,
    );

    expect(rows).toEqual([
      'ffmpeg · FFMPEG_PATH · resolved',
      'ffprobe · FFPROBE_PATH · resolved',
      'whisperCli · WHISPER_CPP_PATH · resolved',
      'whisperModel · WHISPER_MODEL_PATH · resolved',
      'piperCli · PIPER_PATH · resolved',
      'piperModel · PIPER_MODEL_PATH · resolved',
    ]);
  });

  it('reports every queue among the capabilities (US-2-007, US-08-010, US-09-012)', async () => {
    renderBadge(clientWith(() => Promise.resolve(health())));

    await waitFor(() => expect(screen.getByTestId('service-health-capabilities')).toBeTruthy());
    const rows = Array.from(screen.getByTestId('service-health-capabilities').children).map(
      (row) => row.textContent,
    );

    expect(rows).toEqual([
      'renderPipeline · on',
      'assetStore · on',
      'jobQueue · on',
      'montageQueue · on',
      'storyboardQueue · on',
      'voiceQueue · on',
    ]);
  });

  it('lists the two Piper entries by their logical name and env var (US-09-012)', async () => {
    renderBadge(
      clientWith(() =>
        Promise.resolve(
          health({
            status: 'degraded',
            binaries: [
              { name: 'piperCli', envVar: 'PIPER_PATH', resolved: true },
              { name: 'piperModel', envVar: 'PIPER_MODEL_PATH', resolved: false },
            ],
          }),
        ),
      ),
    );

    await waitFor(() => expect(screen.getByTestId('service-health-binaries')).toBeTruthy());
    const rows = Array.from(screen.getByTestId('service-health-binaries').children).map(
      (row) => row.textContent,
    );

    expect(rows).toEqual([
      'piperCli · PIPER_PATH · resolved',
      'piperModel · PIPER_MODEL_PATH · missing',
    ]);
    expect(screen.getByTestId('service-health-label').textContent).toContain('piperModel');
  });

  it('marks a missing binary and a disabled capability, never a resolved host path', async () => {
    renderBadge(
      clientWith(() =>
        Promise.resolve(
          health({
            status: 'degraded',
            binaries: [{ name: 'whisperModel', envVar: 'WHISPER_MODEL_PATH', resolved: false }],
            capabilities: {
              renderPipeline: true,
              assetStore: true,
              jobQueue: true,
              montageQueue: false,
              storyboardQueue: true,
              voiceQueue: true,
            },
          }),
        ),
      ),
    );

    await waitFor(() => expect(screen.getByTestId('service-health-binaries')).toBeTruthy());
    expect(screen.getByTestId('service-health-binaries').textContent).toBe(
      'whisperModel · WHISPER_MODEL_PATH · missing',
    );
    expect(screen.getByTestId('service-health-capabilities').textContent).toContain(
      'montageQueue · off',
    );
  });

  it('says so when no health document could be read', async () => {
    renderBadge(
      clientWith(() =>
        Promise.reject(new RenderApiError('SERVICE_UNREACHABLE', 'down', null, null)),
      ),
    );

    await waitFor(() =>
      expect(screen.getByTestId('service-health-details').textContent).toBe(
        'No health document read yet.',
      ),
    );
  });
});
