import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { ProjectsPage } from './projects-page';
import { RenderApiError } from '../api/render-api-error';
import { RenderApiProvider } from '../api/render-api-context';
import type { ProjectSummary } from '../api/render-api-types';
import type { RenderApiClient } from '../api/render-api-client';

function project(slug: string, layout: Partial<ProjectSummary['layout']> = {}): ProjectSummary {
  return {
    slug,
    layout: { raw: true, catalog: false, timeline: false, edl: false, out: false, ...layout },
  };
}

function renderPage(client: Partial<RenderApiClient>) {
  render(
    <RenderApiProvider client={client as RenderApiClient}>
      <MemoryRouter>
        <ProjectsPage />
      </MemoryRouter>
    </RenderApiProvider>,
  );
}

describe('ProjectsPage', () => {
  it('lists the projects with their layout flags and links to the asset library', async () => {
    renderPage({
      listProjects: vi.fn().mockResolvedValue([project('smoke-ingest', { catalog: true, timeline: true })]),
    });

    await waitFor(() => expect(screen.getByText('smoke-ingest')).toBeTruthy());
    const link = screen.getByRole('link', { name: /smoke-ingest/u });
    expect(link.getAttribute('href')).toBe('/projects/smoke-ingest');
    expect(screen.getByText('catalog').getAttribute('data-present')).toBe('true');
    expect(screen.getByText('edl').getAttribute('data-present')).toBe('false');
  });

  it('says the store is empty instead of showing an empty grid', async () => {
    renderPage({ listProjects: vi.fn().mockResolvedValue([]) });

    await waitFor(() => expect(screen.getByText(/No projects yet/u)).toBeTruthy());
  });

  it('shows the typed error and retries the listing on demand', async () => {
    const listProjects = vi
      .fn()
      .mockRejectedValueOnce(new RenderApiError('SERVICE_UNREACHABLE', 'down', null, null))
      .mockResolvedValueOnce([project('demo')]);
    renderPage({ listProjects });

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('SERVICE_UNREACHABLE'));
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByText('demo')).toBeTruthy());
  });

  it('refreshes the listing after a project is created', async () => {
    const listProjects = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([project('fresh-one')]);
    renderPage({ listProjects, createProject: vi.fn().mockResolvedValue({ slug: 'fresh-one' }) });

    await waitFor(() => expect(screen.getByText(/No projects yet/u)).toBeTruthy());
    fireEvent.change(screen.getByLabelText('New project'), { target: { value: 'fresh-one' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(screen.getByText('fresh-one')).toBeTruthy());
    expect(listProjects).toHaveBeenCalledTimes(2);
  });
});
