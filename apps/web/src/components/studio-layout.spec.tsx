import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '../theme/theme-context';
import { RenderApiProvider, useRenderApi } from '../api/render-api-context';
import { StudioLayout, projectSlugFromPathname } from './studio-layout';
import type { RenderApiClient } from '../api/render-api-client';

function ClientProbe() {
  const client = useRenderApi();
  return <span data-testid="probe">{typeof client.listProjects}</span>;
}

describe('StudioLayout', () => {
  it('frames the routed page with the shell and the health badge', async () => {
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
      <ThemeProvider>
      <RenderApiProvider client={client}>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route element={<StudioLayout />}>
              <Route path="/" element={<p>routed page</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </RenderApiProvider>
      </ThemeProvider>,
    );

    expect(screen.getByRole('img', { name: 'Video Maker by Esteban Burgos' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'My videos' })).toBeTruthy();
    expect(screen.getByTestId('settings-nav').getAttribute('href')).toBe('/settings');
    expect(screen.getByTestId('brands-nav').getAttribute('href')).toBe('/brands');
    expect(screen.getByText('routed page')).toBeTruthy();
    expect(screen.getByTestId('shell-content').getAttribute('data-surface')).toBeNull();
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

describe('StudioLayout project nav', () => {
  function renderAt(pathname: string, mode?: 'footage' | 'motion') {
    const client = {
      getHealth: vi.fn().mockRejectedValue(new Error('not needed here')),
      getProject: vi.fn().mockResolvedValue({ slug: 'smoke-ingest', ...(mode === undefined ? {} : { mode }) }),
      listBrands: vi.fn().mockResolvedValue([]),
    } as unknown as RenderApiClient;

    render(
      <ThemeProvider>
      <RenderApiProvider client={client}>
        <MemoryRouter initialEntries={[pathname]}>
          <Routes>
            <Route element={<StudioLayout />}>
              <Route path="/" element={<p>projects</p>} />
              <Route path="/projects/:slug" element={<p>workspace</p>} />
              <Route path="/projects/:slug/motion" element={<p>motion</p>} />
              <Route path="/projects/:slug/library" element={<p>library</p>} />
              <Route path="/projects/:slug/storyboard" element={<p>storyboard</p>} />
              <Route path="/projects/:slug/voice" element={<p>voice</p>} />
              <Route path="/projects/:slug/preview" element={<p>preview</p>} />
              <Route path="/publish-queue" element={<p>queue</p>} />
              <Route path="/settings" element={<p>settings</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </RenderApiProvider>
      </ThemeProvider>,
    );

    return client;
  }

  function navHrefs(): (string | null)[] {
    return Array.from(screen.getByTestId('project-nav').querySelectorAll('a:not([data-testid="project-brand-motion-link"])')).map((link) =>
      link.getAttribute('href'),
    );
  }

  it('shows no video block outside a project and never loads a project', () => {
    const client = renderAt('/');

    expect(screen.queryByTestId('project-nav')).toBeNull();
    expect(screen.queryByTestId('video-block')).toBeNull();
    expect(client.getProject).not.toHaveBeenCalled();
  });

  it('shows the producer and the four sections at the workspace root of a footage project', async () => {
    renderAt('/projects/smoke-ingest');

    await waitFor(() => expect(screen.getByTestId('project-nav')).toBeTruthy());
    expect(navHrefs()).toEqual([
      '/projects/smoke-ingest',
      '/projects/smoke-ingest/library',
      '/projects/smoke-ingest/storyboard',
      '/projects/smoke-ingest/voice',
      '/projects/smoke-ingest/preview',
    ]);
    expect(screen.getByRole('link', { name: 'producer' }).getAttribute('aria-current')).toBe('page');
  });

  it('adds the motion entry, right after the producer, for a motion project', async () => {
    const client = renderAt('/projects/smoke-ingest/voice', 'motion');

    await waitFor(() => expect(navHrefs()).toContain('/projects/smoke-ingest/motion'));
    expect(client.getProject).toHaveBeenCalledWith('smoke-ingest');
    expect(navHrefs()).toEqual([
      '/projects/smoke-ingest',
      '/projects/smoke-ingest/motion',
      '/projects/smoke-ingest/library',
      '/projects/smoke-ingest/storyboard',
      '/projects/smoke-ingest/voice',
      '/projects/smoke-ingest/preview',
    ]);
  });

  it('marks the producer as current only on the workspace root, not on a section', () => {
    renderAt('/projects/smoke-ingest/voice');

    expect(screen.getByRole('link', { name: 'voice' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'producer' }).getAttribute('aria-current')).toBeNull();
    expect(screen.getByRole('link', { name: 'library' }).getAttribute('aria-current')).toBeNull();
  });

  it('marks the storyboard section as the current one while it is open', () => {
    renderAt('/projects/smoke-ingest/storyboard');

    expect(screen.getByRole('link', { name: 'storyboard' }).getAttribute('aria-current')).toBe('page');
  });

  it('marks the motion section as current on the motion route', async () => {
    renderAt('/projects/smoke-ingest/motion', 'motion');

    const link = await screen.findByRole('link', { name: 'motion' });
    expect(link.getAttribute('aria-current')).toBe('page');
  });

  it('shows the humanized video title and the step as toolbar heading inside a project', async () => {
    renderAt('/projects/smoke-ingest/voice');

    expect(await screen.findByRole('heading', { level: 1, name: 'Voice' })).toBeTruthy();
    expect(within(screen.getByTestId('video-block')).getByText('Smoke ingest')).toBeTruthy();
    expect(within(screen.getByTestId('shell-toolbar')).getByText('Smoke ingest')).toBeTruthy();
  });

  it('keeps the toolbar action out of the way until a page declares one', () => {
    renderAt('/');

    expect(screen.queryByTestId('toolbar-action')).toBeNull();
  });

  it('keeps the routes not migrated yet on the legacy surface', () => {
    renderAt('/settings');

    expect(screen.getByTestId('shell-content').getAttribute('data-surface')).toBe('legacy');
  });
});
