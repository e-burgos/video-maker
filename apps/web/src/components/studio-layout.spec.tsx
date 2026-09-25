import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { RenderApiProvider, useRenderApi } from '../api/render-api-context';
import { StudioLayout, isProjectWorkspaceRoot, projectSlugFromPathname } from './studio-layout';
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
    expect(screen.getByTestId('settings-nav').getAttribute('href')).toBe('/settings');
    expect(screen.getByText('routed page')).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByTestId('service-health-label').textContent).toBe('Ready'),
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

describe('projectSlugFromPathname', () => {
  it('reads the slug of every project route and nothing else', () => {
    expect(projectSlugFromPathname('/projects/smoke-ingest')).toBe('smoke-ingest');
    expect(projectSlugFromPathname('/projects/smoke-ingest/storyboard')).toBe('smoke-ingest');
    expect(projectSlugFromPathname('/projects/smoke-ingest/voice')).toBe('smoke-ingest');
    expect(projectSlugFromPathname('/projects/smoke-ingest/preview')).toBe('smoke-ingest');
    expect(projectSlugFromPathname('/')).toBeNull();
    expect(projectSlugFromPathname('/projects')).toBeNull();
  });

  it('decodes a slug that travelled percent-encoded in the url', () => {
    expect(projectSlugFromPathname('/projects/a%20b/preview')).toBe('a b');
  });
});

describe('isProjectWorkspaceRoot', () => {
  it('is true only for the bare project url', () => {
    expect(isProjectWorkspaceRoot('/projects/smoke-ingest', 'smoke-ingest')).toBe(true);
    expect(isProjectWorkspaceRoot('/projects/smoke-ingest/', 'smoke-ingest')).toBe(true);
    expect(isProjectWorkspaceRoot('/projects/smoke-ingest/library', 'smoke-ingest')).toBe(false);
  });
});

describe('StudioLayout project nav', () => {
  function renderAt(pathname: string) {
    const client = {
      getHealth: vi.fn().mockRejectedValue(new Error('not needed here')),
    } as unknown as RenderApiClient;

    render(
      <RenderApiProvider client={client}>
        <MemoryRouter initialEntries={[pathname]}>
          <Routes>
            <Route element={<StudioLayout />}>
              <Route path="/" element={<p>projects</p>} />
              <Route path="/projects/:slug" element={<p>workspace</p>} />
              <Route path="/projects/:slug/library" element={<p>library</p>} />
              <Route path="/projects/:slug/storyboard" element={<p>storyboard</p>} />
              <Route path="/projects/:slug/voice" element={<p>voice</p>} />
              <Route path="/projects/:slug/preview" element={<p>preview</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </RenderApiProvider>,
    );
  }

  it('shows no project nav outside a project', () => {
    renderAt('/');

    expect(screen.queryByTestId('project-nav')).toBeNull();
  });

  it('shows no project nav at the workspace root: the workspace header carries its own menu', () => {
    renderAt('/projects/smoke-ingest');

    expect(screen.queryByTestId('project-nav')).toBeNull();
  });

  it('links the four advanced-editing sections of the project from any of them', () => {
    renderAt('/projects/smoke-ingest/storyboard');

    const nav = screen.getByTestId('project-nav');
    expect(Array.from(nav.querySelectorAll('a')).map((link) => link.getAttribute('href'))).toEqual([
      '/projects/smoke-ingest/library',
      '/projects/smoke-ingest/storyboard',
      '/projects/smoke-ingest/voice',
      '/projects/smoke-ingest/preview',
    ]);
  });

  it('marks the voice section as the current one while it is open', () => {
    renderAt('/projects/smoke-ingest/voice');

    expect(screen.getByRole('link', { name: 'voice' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'library' }).getAttribute('aria-current')).toBeNull();
  });

  it('marks the storyboard section as the current one while it is open', () => {
    renderAt('/projects/smoke-ingest/storyboard');

    const current = screen.getByRole('link', { name: 'storyboard' });
    expect(current.getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'library' }).getAttribute('aria-current')).toBeNull();
  });

  it('marks the library as the current section only on the library route itself', () => {
    renderAt('/projects/smoke-ingest/library');

    expect(screen.getByRole('link', { name: 'library' }).getAttribute('aria-current')).toBe('page');
  });
});
