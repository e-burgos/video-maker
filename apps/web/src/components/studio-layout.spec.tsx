import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { RenderApiProvider, useRenderApi } from '../api/render-api-context';
import { StudioLayout } from './studio-layout';
import type { RenderApiClient } from '../api/render-api-client';

function ClientProbe() {
  const client = useRenderApi();
  return <span data-testid="probe">{typeof client.listProjects}</span>;
}

describe('StudioLayout', () => {
  it('frames the routed page with the studio header and the health badge', async () => {
    const client = {
      getHealth: vi.fn().mockResolvedValue({
        status: 'ok',
        service: 'render-api',
        cycle: 3,
        time: '2026-09-09T00:00:00.000Z',
        engine: [],
        binaries: [],
        capabilities: { renderPipeline: true, assetStore: true, jobQueue: true },
        jobs: { running: 0, queued: 0 },
      }),
    } as unknown as RenderApiClient;

    render(
      <RenderApiProvider client={client}>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route element={<StudioLayout />}>
              <Route path="/" element={<p>routed page</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </RenderApiProvider>,
    );

    expect(screen.getByRole('link', { name: 'Video Maker Studio' })).toBeTruthy();
    expect(screen.getByText('routed page')).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByTestId('service-health-label').textContent).toBe('service ok · cycle 3'),
    );
  });

  it('builds a client from the global fetch when none is injected', () => {
    render(
      <RenderApiProvider>
        <ClientProbe />
      </RenderApiProvider>,
    );

    expect(screen.getByTestId('probe').textContent).toBe('function');
  });

  it('refuses to hand out a client outside the provider', () => {
    expect(() => render(<ClientProbe />)).toThrow('useRenderApi must be used inside');
  });
});
