import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { ProjectsPage } from './projects-page';
import { RenderApiError } from '../api/render-api-error';
import { RenderApiProvider } from '../api/render-api-context';
import type { ProjectSummary, VideoOrganization } from '../api/render-api-types';
import type { RenderApiClient } from '../api/render-api-client';

function project(slug: string, layout: Partial<ProjectSummary['layout']> = {}): ProjectSummary {
  return {
    slug,
    layout: { raw: true, catalog: false, timeline: false, edl: false, out: false, ...layout },
  };
}

const EMPTY_ORGANIZATION: VideoOrganization = { folders: [], videos: {} };

const DISPLAY_ADS: VideoOrganization = {
  folders: [
    { id: 'display-ads', name: 'Display Ads', categories: [{ id: 'campanas', name: 'Campañas' }] },
  ],
  videos: {
    'editar-campana': { folderId: 'display-ads', categoryId: 'campanas', archived: false },
    'linea-de-tiempo': { folderId: 'display-ads', categoryId: null, archived: false },
  },
};

function renderPage(client: Partial<RenderApiClient>) {
  const withBrands = { listBrands: vi.fn().mockResolvedValue([]), ...client };
  render(
    <RenderApiProvider client={withBrands as RenderApiClient}>
      <MemoryRouter>
        <ProjectsPage />
      </MemoryRouter>
    </RenderApiProvider>,
  );
}

function section(folderId: string): HTMLElement {
  const found = document.querySelector(`[data-folder="${folderId}"]`);
  if (found === null) {
    throw new Error(`no folder section for ${folderId}`);
  }
  return found as HTMLElement;
}

describe('ProjectsPage', () => {
  it('lists the videos with a humanized title, their status and opens each one on its workspace', async () => {
    renderPage({
      listProjects: vi.fn().mockResolvedValue([project('smoke-ingest', { catalog: true, timeline: true })]),
      getOrganization: vi.fn().mockResolvedValue(EMPTY_ORGANIZATION),
    });

    await waitFor(() => expect(screen.getByText('smoke-ingest')).toBeTruthy());
    const link = screen.getByRole('link', { name: /smoke-ingest/u });
    expect(link.getAttribute('href')).toBe('/projects/smoke-ingest');
    expect(screen.getByText('Smoke ingest')).toBeTruthy();
    expect(screen.getByText('Cut ready')).toBeTruthy();
  });

  it('drops every unassigned video into the No folder folder', async () => {
    renderPage({
      listProjects: vi.fn().mockResolvedValue([project('suelto-uno'), project('suelto-dos')]),
      getOrganization: vi.fn().mockResolvedValue(EMPTY_ORGANIZATION),
    });

    await waitFor(() => expect(screen.getByText('suelto-uno')).toBeTruthy());
    const unassigned = section('unassigned');
    expect(within(unassigned).getByText('No folder')).toBeTruthy();
    expect(within(unassigned).getAllByTestId('video-card')).toHaveLength(2);
  });

  it('files each video under its folder and its category', async () => {
    renderPage({
      listProjects: vi
        .fn()
        .mockResolvedValue([project('editar-campana'), project('linea-de-tiempo'), project('suelto')]),
      getOrganization: vi.fn().mockResolvedValue(DISPLAY_ADS),
    });

    await waitFor(() => expect(screen.getByText('editar-campana')).toBeTruthy());

    const folder = section('display-ads');
    expect(within(folder).getByTestId('folder-count').textContent).toBe('(2)');

    const categorized = folder.querySelector('[data-category="campanas"]') as HTMLElement;
    expect(within(categorized).getByText('editar-campana')).toBeTruthy();

    const uncategorized = folder.querySelector('[data-category="uncategorized"]') as HTMLElement;
    expect(within(uncategorized).getByText('linea-de-tiempo')).toBeTruthy();
    expect(within(uncategorized).getByText('No category')).toBeTruthy();

    expect(within(section('unassigned')).getByText('suelto')).toBeTruthy();
  });

  it('shows an empty folder instead of hiding it, so a new project is visible', async () => {
    renderPage({
      listProjects: vi.fn().mockResolvedValue([project('suelto')]),
      getOrganization: vi.fn().mockResolvedValue({ folders: DISPLAY_ADS.folders, videos: {} }),
    });

    await waitFor(() => expect(screen.getByText('suelto')).toBeTruthy());
    expect(within(section('display-ads')).getByTestId('folder-empty')).toBeTruthy();
  });

  it('keeps every folder visible when the account has zero videos, instead of the generic empty state', async () => {
    renderPage({
      listProjects: vi.fn().mockResolvedValue([]),
      getOrganization: vi.fn().mockResolvedValue({ folders: DISPLAY_ADS.folders, videos: {} }),
    });

    await waitFor(() => expect(screen.getByTestId('folder-section')).toBeTruthy());
    expect(within(section('display-ads')).getByTestId('folder-empty')).toBeTruthy();
    expect(screen.queryByText(/No videos yet/u)).toBeNull();
  });

  it('keeps the archived videos out of the folders, behind their own toggle', async () => {
    renderPage({
      listProjects: vi.fn().mockResolvedValue([project('vivo'), project('guardado')]),
      getOrganization: vi.fn().mockResolvedValue({
        folders: [],
        videos: { guardado: { folderId: null, categoryId: null, archived: true } },
      }),
    });

    await waitFor(() => expect(screen.getByText('vivo')).toBeTruthy());
    expect(screen.queryByText('guardado')).toBeNull();

    fireEvent.click(screen.getByTestId('archived-toggle'));
    expect(screen.getByText('guardado')).toBeTruthy();
  });

  it('says the store is empty instead of showing an empty grid', async () => {
    renderPage({
      listProjects: vi.fn().mockResolvedValue([]),
      getOrganization: vi.fn().mockResolvedValue(EMPTY_ORGANIZATION),
    });

    await waitFor(() => expect(screen.getByText(/No videos yet/u)).toBeTruthy());
  });

  it('shows the typed error and retries the listing on demand', async () => {
    const listProjects = vi
      .fn()
      .mockRejectedValueOnce(new RenderApiError('SERVICE_UNREACHABLE', 'down', null, null))
      .mockResolvedValueOnce([project('demo')]);
    renderPage({ listProjects, getOrganization: vi.fn().mockResolvedValue(EMPTY_ORGANIZATION) });

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('SERVICE_UNREACHABLE'));
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByText('demo')).toBeTruthy());
  });

  it('refreshes the listing after a video is created', async () => {
    const listProjects = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([project('fresh-one')]);
    renderPage({
      listProjects,
      getOrganization: vi.fn().mockResolvedValue(EMPTY_ORGANIZATION),
      createProject: vi.fn().mockResolvedValue({ slug: 'fresh-one' }),
    });

    await waitFor(() => expect(screen.getByText(/No videos yet/u)).toBeTruthy());
    fireEvent.click(screen.getByTestId('new-video-cta'));
    fireEvent.change(screen.getByLabelText('Video name'), { target: { value: 'fresh-one' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create video' }));

    await waitFor(() => expect(screen.getByText('fresh-one')).toBeTruthy());
    expect(listProjects).toHaveBeenCalledTimes(2);
  });

  it('creates a folder and reloads both the videos and the organization', async () => {
    const getOrganization = vi
      .fn()
      .mockResolvedValueOnce(EMPTY_ORGANIZATION)
      .mockResolvedValueOnce({ folders: DISPLAY_ADS.folders, videos: {} });
    const createFolder = vi.fn().mockResolvedValue({ id: 'display-ads', name: 'Display Ads', categories: [] });

    renderPage({
      listProjects: vi.fn().mockResolvedValue([project('suelto')]),
      getOrganization,
      createFolder,
    });

    await waitFor(() => expect(screen.getByText('suelto')).toBeTruthy());
    fireEvent.change(screen.getByTestId('create-folder-name'), { target: { value: 'Display Ads' } });
    fireEvent.click(screen.getByTestId('create-folder-submit'));

    await waitFor(() => expect(screen.getByText('Display Ads')).toBeTruthy());
    expect(createFolder).toHaveBeenCalledWith('Display Ads');
  });
});
