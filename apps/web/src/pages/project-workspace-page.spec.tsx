import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { producerConversation, producerSettings } from '../api/__fixtures__/producer';
import { RenderApiProvider } from '../api/render-api-context';
import { RenderApiError } from '../api/render-api-error';
import { ProjectWorkspacePage } from './project-workspace-page';
import type { RenderApiClient } from '../api/render-api-client';
import type { AssetListing, ServiceHealth } from '../api/render-api-types';

function health(): ServiceHealth {
  return {
    status: 'ok',
    service: 'render-api',
    cycle: 3,
    time: '2026-09-10T00:00:00.000Z',
    engine: [],
    binaries: [],
    capabilities: {
      renderPipeline: true,
      assetStore: true,
      jobQueue: true,
      montageQueue: true,
      storyboardQueue: true,
      voiceQueue: true,
      producer: true,
    },
    jobs: { running: 0, queued: 0 },
  };
}

function assetListing(): AssetListing {
  return { slug: 'demo-01', source: 'catalog', assets: [], probeFailures: [] };
}

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches,
      media: '(min-width: 1100px)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

function renderWorkspace(client: Partial<RenderApiClient> = {}) {
  const withDefaults: Partial<RenderApiClient> = {
    getHealth: vi.fn().mockResolvedValue(health()),
    listAssets: vi.fn().mockResolvedValue(assetListing()),
    listRenderJobs: vi.fn().mockResolvedValue({ slug: 'demo-01', jobs: [] }),
    listGenerated: vi.fn().mockResolvedValue({ slug: 'demo-01', roots: [], files: [] }),
    getProducer: vi.fn().mockResolvedValue(producerConversation()),
    getProducerSettings: vi.fn().mockResolvedValue(producerSettings()),
    getTimeline: vi.fn().mockRejectedValue(new RenderApiError('TIMELINE_NOT_FOUND', 'none', 404, null)),
    ...client,
  };

  render(
    <RenderApiProvider client={withDefaults as RenderApiClient}>
      <MemoryRouter initialEntries={['/projects/demo-01']}>
        <Routes>
          <Route path="/projects/:slug" element={<ProjectWorkspacePage />} />
        </Routes>
      </MemoryRouter>
    </RenderApiProvider>,
  );

  return withDefaults;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ProjectWorkspacePage', () => {
  it('shows the project name and the advanced editing menu with all four destinations', async () => {
    stubMatchMedia(true);
    renderWorkspace();

    expect(screen.getByRole('heading', { name: 'demo-01' })).toBeTruthy();

    const menu = screen.getByTestId('workspace-advanced-menu');
    const hrefs = Array.from(menu.querySelectorAll('a')).map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual([
      '/projects/demo-01/library',
      '/projects/demo-01/storyboard',
      '/projects/demo-01/voice',
      '/projects/demo-01/preview',
    ]);
  });

  it('lays the chat and the side panel out side by side on a wide viewport', async () => {
    stubMatchMedia(true);
    renderWorkspace();

    await waitFor(() => expect(screen.getByTestId('producer-conversation-panel')).toBeTruthy());
    expect(screen.getByTestId('workspace-side-panel')).toBeTruthy();
    expect(screen.queryByTestId('workspace-panel-toggle')).toBeNull();
  });

  it('collapses the side panel into a drawer below the chat on a narrow viewport', async () => {
    stubMatchMedia(false);
    renderWorkspace();

    await waitFor(() => expect(screen.getByTestId('producer-conversation-panel')).toBeTruthy());
    expect(screen.queryByTestId('workspace-side-panel')).toBeNull();

    fireEvent.click(screen.getByTestId('workspace-panel-toggle'));

    expect(screen.getByTestId('workspace-side-panel')).toBeTruthy();
  });
});
