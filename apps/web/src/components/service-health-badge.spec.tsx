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
    ],
    capabilities: { renderPipeline: true, assetStore: true, jobQueue: true },
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
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() =>
      expect(screen.getByTestId('service-health-label').textContent).toBe('service ok · cycle 3'),
    );
  });
});
