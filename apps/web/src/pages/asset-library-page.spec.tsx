import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AssetLibraryPage } from './asset-library-page';
import { RenderApiError } from '../api/render-api-error';
import { RenderApiProvider } from '../api/render-api-context';
import type { AssetListEntry, AssetListing } from '../api/render-api-types';
import type { RenderApiClient } from '../api/render-api-client';

function asset(path: string, role: AssetListEntry['role']): AssetListEntry {
  return { path, role, fingerprint: { sizeBytes: 1024, modifiedAtMs: 1 }, media: null };
}

const listing: AssetListing = {
  slug: 'smoke-ingest',
  source: 'catalog',
  assets: [
    asset('raw/aroll/clip01.mp4', 'aroll'),
    asset('raw/broll/clip01.mp4', 'broll'),
    asset('raw/images/photo01.jpg', 'image'),
    asset('raw/audio/music01.mp3', 'audio'),
  ],
  probeFailures: [],
};

const HEALTHY_SERVICE = {
  status: 'ok' as const,
  service: 'render-api',
  cycle: 3,
  time: '2026-09-09T10:00:00.000Z',
  engine: [{ name: 'media-local', loaded: true }],
  binaries: [
    { name: 'ffmpeg', envVar: 'FFMPEG_PATH', resolved: true },
    { name: 'ffprobe', envVar: 'FFPROBE_PATH', resolved: true },
    { name: 'whisperCli', envVar: 'WHISPER_CPP_PATH', resolved: true },
    { name: 'whisperModel', envVar: 'WHISPER_MODEL_PATH', resolved: true },
  ],
  capabilities: { renderPipeline: true, assetStore: true, jobQueue: true, montageQueue: true },
  jobs: { running: 0, queued: 0 },
};

function renderPage(client: Partial<RenderApiClient>) {
  const withHealth: Partial<RenderApiClient> = {
    getHealth: vi.fn().mockResolvedValue(HEALTHY_SERVICE),
    ...client,
  };
  render(
    <RenderApiProvider client={withHealth as RenderApiClient}>
      <MemoryRouter initialEntries={['/projects/smoke-ingest']}>
        <Routes>
          <Route path="/projects/:slug" element={<AssetLibraryPage />} />
        </Routes>
      </MemoryRouter>
    </RenderApiProvider>,
  );
}

describe('AssetLibraryPage', () => {
  it('groups the assets by the four roles and shows the listing source', async () => {
    renderPage({ listAssets: vi.fn().mockResolvedValue(listing) });

    await waitFor(() => expect(screen.getByTestId('asset-source').textContent).toBe('catalog'));
    for (const role of ['aroll', 'broll', 'image', 'audio']) {
      const group = screen.getByTestId(`role-${role}`);
      expect(within(group).getAllByRole('listitem')).toHaveLength(1);
    }
    expect(screen.getAllByTestId('asset-preview-video')).toHaveLength(2);
    expect(screen.getAllByTestId('asset-preview-image')).toHaveLength(1);
    expect(screen.getAllByTestId('asset-preview-audio')).toHaveLength(1);
  });

  it('asks the service for the slug in the route', async () => {
    const listAssets = vi.fn().mockResolvedValue(listing);
    renderPage({ listAssets });

    await waitFor(() => expect(listAssets).toHaveBeenCalledWith('smoke-ingest'));
  });

  it('says a role is empty instead of hiding it', async () => {
    renderPage({
      listAssets: vi.fn().mockResolvedValue({ ...listing, assets: [asset('raw/aroll/a.mp4', 'aroll')] }),
    });

    await waitFor(() => expect(screen.getByText('No broll assets yet.')).toBeTruthy());
  });

  it('surfaces the probe failures the catalog recorded', async () => {
    renderPage({
      listAssets: vi.fn().mockResolvedValue({
        ...listing,
        probeFailures: [{ path: 'raw/broll/bad.mp4', errorCode: 'MEDIA_OUTPUT_UNPARSEABLE' }],
      }),
    });

    await waitFor(() =>
      expect(screen.getByRole('note').textContent).toContain('MEDIA_OUTPUT_UNPARSEABLE'),
    );
  });

  it('shows the typed error and retries the listing on demand', async () => {
    const listAssets = vi
      .fn()
      .mockRejectedValueOnce(new RenderApiError('PROJECT_NOT_FOUND', 'gone', 404, null))
      .mockResolvedValueOnce(listing);
    renderPage({ listAssets });

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('PROJECT_NOT_FOUND'));
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByTestId('asset-source').textContent).toBe('catalog'));
  });

  it('refreshes the listing after an upload succeeds', async () => {
    const listAssets = vi
      .fn()
      .mockResolvedValueOnce({ ...listing, assets: [] })
      .mockResolvedValueOnce(listing);
    renderPage({
      listAssets,
      uploadAsset: vi.fn().mockResolvedValue({ path: 'raw/aroll/clip01.mp4' }),
    });

    await waitFor(() => expect(screen.getByText('No aroll assets yet.')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Asset file'), {
      target: { files: [new File(['b'], 'clip01.mp4', { type: 'video/mp4' })] },
    });

    await waitFor(() => expect(listAssets).toHaveBeenCalledTimes(2));
  });
});

describe('AssetLibraryPage montage', () => {
  function renderWithPreviewRoute(client: Partial<RenderApiClient>) {
    render(
      <RenderApiProvider
        client={
          {
            getHealth: vi.fn().mockResolvedValue(HEALTHY_SERVICE),
            listAssets: vi.fn().mockResolvedValue(listing),
            ...client,
          } as RenderApiClient
        }
      >
        <MemoryRouter initialEntries={['/projects/smoke-ingest']}>
          <Routes>
            <Route path="/projects/:slug" element={<AssetLibraryPage />} />
            <Route path="/projects/:slug/preview" element={<p>preview route</p>} />
          </Routes>
        </MemoryRouter>
      </RenderApiProvider>,
    );
  }

  it('offers the montage trigger next to the asset library', async () => {
    renderWithPreviewRoute({});

    await waitFor(() => expect(screen.getByTestId('montage-trigger')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Generate montage' })).toBeTruthy();
  });

  it('follows the created job and jumps to the preview once the montage succeeds', async () => {
    const createMontageJob = vi.fn().mockResolvedValue({
      id: 'job-0002',
      kind: 'montage',
      slug: 'smoke-ingest',
      state: 'queued',
      createdAt: '2026-09-09T10:00:00.000Z',
      startedAt: null,
      finishedAt: null,
      progress: null,
      report: null,
      error: null,
    });
    const getRenderJob = vi.fn().mockResolvedValue({
      id: 'job-0002',
      kind: 'montage',
      slug: 'smoke-ingest',
      state: 'succeeded',
      createdAt: '2026-09-09T10:00:00.000Z',
      startedAt: '2026-09-09T10:00:01.000Z',
      finishedAt: '2026-09-09T10:00:06.000Z',
      progress: null,
      report: {
        catalogPath: 'work/catalog.json',
        timelinePath: 'work/timeline.json',
        editDecisionListPath: 'work/edl.json',
        preset: 'software-demo',
        seed: 0,
      },
      error: null,
    });

    renderWithPreviewRoute({ createMontageJob, getRenderJob });

    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Generate montage' }) as HTMLButtonElement).disabled).toBe(
        false,
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Generate montage' }));

    await waitFor(() => expect(screen.getByText('preview route')).toBeTruthy());
    expect(getRenderJob).toHaveBeenCalledWith('job-0002');
  });
});
