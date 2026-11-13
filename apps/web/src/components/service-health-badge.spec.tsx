import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
      { name: 'ttsCli', envVar: 'TTS_CLI_PATH', resolved: true },
      { name: 'ttsVoicesDir', envVar: 'TTS_VOICES_DIR', resolved: true },
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

function openDetails(): void {
  fireEvent.click(screen.getByTestId('service-health-trigger'));
}

describe('ServiceHealthBadge', () => {
  it('reports the healthy service as ready', async () => {
    renderBadge(clientWith(() => Promise.resolve(health())));

    await waitFor(() =>
      expect(screen.getByTestId('service-health-label').textContent).toBe('Ready'),
    );
  });

  it('groups the missing engine module and binary into user-language categories, never raw ids', async () => {
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
        'Missing: engine, video tools',
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

  it('re-checks the service from the modal footer', async () => {
    const getHealth = vi
      .fn()
      .mockResolvedValueOnce(health({ status: 'degraded', engine: [{ name: 'ffmpeg', loaded: false }], binaries: [] }))
      .mockResolvedValueOnce(health());
    renderBadge(clientWith(getHealth));

    await waitFor(() =>
      expect(screen.getByTestId('service-health-label').textContent).toContain('Missing'),
    );
    openDetails();
    fireEvent.click(within(screen.getByTestId('service-health-modal')).getByTitle('Re-check the render service'));
    await waitFor(() =>
      expect(screen.getByTestId('service-health-label').textContent).toBe('Ready'),
    );
  });

  it('lists the six media binaries with their env var and resolution state (US-2-007, US-09-012)', async () => {
    renderBadge(clientWith(() => Promise.resolve(health())));

    await waitFor(() => expect(screen.getByTestId('service-health-label').textContent).not.toBe('checking service'));
    openDetails();
    await waitFor(() => expect(screen.getByTestId('service-health-binaries')).toBeTruthy());
    const rows = Array.from(screen.getByTestId('service-health-binaries').children).map(
      (row) => row.textContent,
    );

    expect(rows).toEqual([
      'ffmpeg · FFMPEG_PATH · resolved',
      'ffprobe · FFPROBE_PATH · resolved',
      'whisperCli · WHISPER_CPP_PATH · resolved',
      'whisperModel · WHISPER_MODEL_PATH · resolved',
      'ttsCli · TTS_CLI_PATH · resolved',
      'ttsVoicesDir · TTS_VOICES_DIR · resolved',
    ]);
  });

  it('reports every queue among the capabilities (US-2-007, US-08-010, US-09-012)', async () => {
    renderBadge(clientWith(() => Promise.resolve(health())));

    await waitFor(() => expect(screen.getByTestId('service-health-label').textContent).not.toBe('checking service'));
    openDetails();
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

  it('lists the two voice-engine entries by their logical name and env var (US-09-012)', async () => {
    renderBadge(
      clientWith(() =>
        Promise.resolve(
          health({
            status: 'degraded',
            binaries: [
              { name: 'ttsCli', envVar: 'TTS_CLI_PATH', resolved: true },
              { name: 'ttsVoicesDir', envVar: 'TTS_VOICES_DIR', resolved: false },
            ],
          }),
        ),
      ),
    );

    await waitFor(() => expect(screen.getByTestId('service-health-label').textContent).not.toBe('checking service'));
    openDetails();
    await waitFor(() => expect(screen.getByTestId('service-health-binaries')).toBeTruthy());
    const rows = Array.from(screen.getByTestId('service-health-binaries').children).map(
      (row) => row.textContent,
    );

    expect(rows).toEqual([
      'ttsCli · TTS_CLI_PATH · resolved',
      'ttsVoicesDir · TTS_VOICES_DIR · missing',
    ]);
    expect(screen.getByTestId('service-health-label').textContent).toBe('Missing: voice engine');
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

    await waitFor(() => expect(screen.getByTestId('service-health-label').textContent).not.toBe('checking service'));
    openDetails();
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
      expect(screen.getByTestId('service-health-label').textContent).toContain('unreachable'),
    );
    openDetails();
    expect(screen.getByTestId('service-health-details').textContent).toBe(
      'No health document read yet.',
    );
  });

  it('keeps the modal closed until the status control is used, then closes with Escape', async () => {
    renderBadge(clientWith(() => Promise.resolve(health())));

    await waitFor(() => expect(screen.getByTestId('service-health-label').textContent).toBe('Ready'));
    expect(screen.queryByTestId('service-health-details')).toBeNull();

    openDetails();
    expect(screen.getByRole('dialog').textContent).toContain('Service status');

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('service-health-details')).toBeNull());
  });

  it('shows the four sections and names the control after its state plus the details', async () => {
    renderBadge(clientWith(() => Promise.resolve(health())));

    await waitFor(() => expect(screen.getByTestId('service-health-label').textContent).toBe('Ready'));
    expect(screen.getByTestId('service-health-trigger').getAttribute('aria-label')).toBe('Ready, details');
    openDetails();

    const details = within(screen.getByTestId('service-health-details'));
    ['engines', 'binaries', 'capabilities', 'jobs'].forEach((title) => {
      expect(details.getByRole('heading', { name: title })).toBeTruthy();
    });
    expect(details.getByText('0 running · 0 queued')).toBeTruthy();
  });

  it('closes from the footer button', async () => {
    renderBadge(clientWith(() => Promise.resolve(health())));

    await waitFor(() => expect(screen.getByTestId('service-health-label').textContent).toBe('Ready'));
    openDetails();
    fireEvent.click(screen.getByTestId('service-health-close'));

    await waitFor(() => expect(screen.queryByTestId('service-health-details')).toBeNull());
  });
});
