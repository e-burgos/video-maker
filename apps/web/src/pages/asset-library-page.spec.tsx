import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AssetLibraryPage } from './asset-library-page';
import { RenderApiError } from '../api/render-api-error';
import { RenderApiProvider } from '../api/render-api-context';
import type { AssetListEntry, AssetListing } from '../api/render-api-types';
import type { RenderApiClient } from '../api/render-api-client';

function asset(path: string, role: AssetListEntry['role']): AssetListEntry {
  return {
    path,
    role,
    fingerprint: { sizeBytes: 1024, modifiedAtMs: 1 },
    media: null,
  };
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

const EMPTY_GENERATED = {
  slug: 'smoke-ingest',
  roots: ['work/voice', 'work/producer', 'out'],
  files: [],
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
  capabilities: {
    renderPipeline: true,
    assetStore: true,
    jobQueue: true,
    montageQueue: true,
    storyboardQueue: true,
    voiceQueue: true,
  },
  jobs: { running: 0, queued: 0 },
};

function renderPage(client: Partial<RenderApiClient>) {
  const withHealth: Partial<RenderApiClient> = {
    getProject: vi.fn().mockResolvedValue({ slug: 'smoke-ingest' }),
    getHealth: vi.fn().mockResolvedValue(HEALTHY_SERVICE),
    listGenerated: vi.fn().mockResolvedValue(EMPTY_GENERATED),
    getVoice: vi
      .fn()
      .mockRejectedValue(
        new RenderApiError('VOICE_NOT_FOUND', 'no voice', 404, null),
      ),
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

function cardsOf(role: string) {
  return screen
    .queryAllByTestId('asset-card')
    .filter((card) => card.getAttribute('data-role') === role);
}

describe('AssetLibraryPage', () => {
  it('shows one opaque tile per asset with its role chip and the listing source', async () => {
    renderPage({ listAssets: vi.fn().mockResolvedValue(listing) });

    await waitFor(() =>
      expect(screen.getByTestId('asset-source').textContent).toBe('catalog'),
    );
    expect(screen.getAllByTestId('asset-card')).toHaveLength(4);
    for (const role of ['aroll', 'broll', 'image', 'audio']) {
      expect(cardsOf(role)).toHaveLength(1);
    }
    expect(
      within(cardsOf('aroll')[0] as HTMLElement).getByText('A-roll'),
    ).toBeTruthy();
  });

  it('asks the service for the slug in the route', async () => {
    const listAssets = vi.fn().mockResolvedValue(listing);
    renderPage({ listAssets });

    await waitFor(() =>
      expect(listAssets).toHaveBeenCalledWith('smoke-ingest'),
    );
  });

  it('summarizes each role as complete, missing or to review', async () => {
    renderPage({
      listAssets: vi
        .fn()
        .mockResolvedValue({
          ...listing,
          assets: [
            asset('raw/broll/a.mp4', 'broll'),
            asset('raw/images/p.jpg', 'image'),
          ],
        }),
      getMaterialReview: vi.fn().mockResolvedValue({
        slug: 'smoke-ingest',
        path: 'work/producer/material-review.json',
        review: null,
        warnings: {
          items: [
            {
              file: 'images/p.jpg',
              source: 'project',
              shows: 'blurry',
              verdict: 'doubtful',
              reason: 'soft',
            },
          ],
          gaps: [],
        },
      }),
    });

    await waitFor(() =>
      expect(
        screen.getAllByTestId('library-summary-role').length,
      ).toBeGreaterThan(0),
    );
    const statusOf = (role: string) =>
      screen
        .getAllByTestId('library-summary-role')
        .find((entry) => entry.getAttribute('data-role') === role)
        ?.getAttribute('data-status');
    expect(statusOf('aroll')).toBe('missing');
    expect(statusOf('broll')).toBe('complete');
    await waitFor(() => expect(statusOf('image')).toBe('review'));
  });

  it('filters the grid by role', async () => {
    renderPage({ listAssets: vi.fn().mockResolvedValue(listing) });

    await waitFor(() =>
      expect(screen.getAllByTestId('asset-card')).toHaveLength(4),
    );
    fireEvent.click(screen.getByTestId('library-filter-broll'));

    expect(screen.getAllByTestId('asset-card')).toHaveLength(1);
    expect(cardsOf('broll')).toHaveLength(1);
  });

  it('selects tiles, offers compare only for exactly two and clears the selection', async () => {
    renderPage({ listAssets: vi.fn().mockResolvedValue(listing) });

    await waitFor(() =>
      expect(screen.getAllByTestId('asset-select')).toHaveLength(4),
    );
    expect(screen.queryByTestId('library-selection-bar')).toBeNull();

    fireEvent.click(screen.getAllByTestId('asset-select')[0] as HTMLElement);
    expect(screen.getByTestId('library-selection-count').textContent).toBe(
      '1 selected',
    );
    expect(
      (screen.getByTestId('library-selection-compare') as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    fireEvent.click(screen.getAllByTestId('asset-select')[1] as HTMLElement);
    expect(screen.getByTestId('library-selection-count').textContent).toBe(
      '2 selected',
    );
    expect(
      (screen.getByTestId('library-selection-compare') as HTMLButtonElement)
        .disabled,
    ).toBe(false);

    fireEvent.click(screen.getByTestId('library-selection-clear'));
    expect(screen.queryByTestId('library-selection-bar')).toBeNull();
  });

  it('opens the viewer from a tile and returns the focus to it when closed', async () => {
    renderPage({ listAssets: vi.fn().mockResolvedValue(listing) });

    await waitFor(() =>
      expect(screen.getAllByTestId('asset-open')).toHaveLength(4),
    );
    const trigger = screen.getAllByTestId('asset-open')[0] as HTMLElement;
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.getByTestId('media-viewer')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByTestId('media-viewer')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('compares the two selected tiles in the viewer', async () => {
    renderPage({ listAssets: vi.fn().mockResolvedValue(listing) });

    await waitFor(() =>
      expect(screen.getAllByTestId('asset-select')).toHaveLength(4),
    );
    fireEvent.click(screen.getAllByTestId('asset-select')[0] as HTMLElement);
    fireEvent.click(screen.getAllByTestId('asset-select')[2] as HTMLElement);
    fireEvent.click(screen.getByTestId('library-selection-compare'));

    const paths = screen
      .getAllByTestId('viewer-stage')
      .map((stage) => stage.getAttribute('data-asset-path'));
    expect(paths).toEqual(['raw/aroll/clip01.mp4', 'raw/images/photo01.jpg']);
  });

  it('reloads the listing after a tile deletes its asset', async () => {
    const listAssets = vi
      .fn()
      .mockResolvedValueOnce(listing)
      .mockResolvedValueOnce({ ...listing, assets: listing.assets.slice(1) });
    const deleteAsset = vi.fn().mockResolvedValue({
      slug: 'smoke-ingest',
      deleted: {
        path: 'raw/aroll/clip01.mp4',
        role: 'aroll',
        catalogEntryRemoved: true,
        removedArtifacts: [],
      },
      timelineReferences: [],
    });
    renderPage({ listAssets, deleteAsset });

    await waitFor(() =>
      expect(screen.getAllByTestId('asset-card')).toHaveLength(4),
    );
    const arollCard = cardsOf('aroll')[0] as HTMLElement;
    fireEvent.click(within(arollCard).getByTestId('asset-menu'));
    fireEvent.click(within(arollCard).getByTestId('asset-delete-open'));
    fireEvent.click(screen.getByTestId('asset-delete-accept'));

    await waitFor(() =>
      expect(deleteAsset).toHaveBeenCalledWith({
        slug: 'smoke-ingest',
        role: 'aroll',
        filename: 'clip01.mp4',
        force: false,
      }),
    );
    await waitFor(() => expect(cardsOf('aroll')).toHaveLength(0));
    expect(listAssets).toHaveBeenCalledTimes(2);
  });

  it('deletes the whole selection from the sticky bar', async () => {
    const deleteAsset = vi.fn().mockResolvedValue({
      slug: 'smoke-ingest',
      deleted: {
        path: 'x',
        role: 'aroll',
        catalogEntryRemoved: true,
        removedArtifacts: [],
      },
      timelineReferences: [],
    });
    renderPage({ listAssets: vi.fn().mockResolvedValue(listing), deleteAsset });

    await waitFor(() =>
      expect(screen.getAllByTestId('asset-select')).toHaveLength(4),
    );
    fireEvent.click(screen.getAllByTestId('asset-select')[0] as HTMLElement);
    fireEvent.click(screen.getAllByTestId('asset-select')[1] as HTMLElement);
    fireEvent.click(screen.getByTestId('library-selection-delete'));

    expect(screen.getByTestId('asset-delete-confirm').textContent).toContain(
      'Delete 2 files?',
    );
    fireEvent.click(screen.getByTestId('asset-delete-accept'));

    await waitFor(() => expect(deleteAsset).toHaveBeenCalledTimes(2));
  });

  it('surfaces the probe failures the catalog recorded', async () => {
    renderPage({
      listAssets: vi.fn().mockResolvedValue({
        ...listing,
        probeFailures: [
          { path: 'raw/broll/bad.mp4', errorCode: 'MEDIA_OUTPUT_UNPARSEABLE' },
        ],
      }),
    });

    await waitFor(() =>
      expect(screen.getByRole('note').textContent).toContain(
        'MEDIA_OUTPUT_UNPARSEABLE',
      ),
    );
  });

  it('shows the typed error and retries the listing on demand', async () => {
    const listAssets = vi
      .fn()
      .mockRejectedValueOnce(
        new RenderApiError('PROJECT_NOT_FOUND', 'gone', 404, null),
      )
      .mockResolvedValueOnce(listing);
    renderPage({ listAssets });

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'PROJECT_NOT_FOUND',
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() =>
      expect(screen.getByTestId('asset-source').textContent).toBe('catalog'),
    );
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

    await waitFor(() =>
      expect(screen.getByTestId('library-empty')).toBeTruthy(),
    );
    fireEvent.change(screen.getByLabelText('Asset file'), {
      target: { files: [new File(['b'], 'clip01.mp4', { type: 'video/mp4' })] },
    });

    await waitFor(() => expect(listAssets).toHaveBeenCalledTimes(2));
  });

  it('uploads a file dropped on the uploader', async () => {
    const uploadAsset = vi
      .fn()
      .mockResolvedValue({ path: 'raw/aroll/clip01.mp4' });
    renderPage({
      listAssets: vi.fn().mockResolvedValue({ ...listing, assets: [] }),
      uploadAsset,
    });

    await waitFor(() =>
      expect(screen.getByTestId('library-empty')).toBeTruthy(),
    );
    const file = new File(['b'], 'clip01.mp4', { type: 'video/mp4' });
    fireEvent.drop(screen.getByTestId('asset-uploader'), {
      dataTransfer: { files: [file] },
    });

    await waitFor(() =>
      expect(uploadAsset).toHaveBeenCalledWith(
        expect.objectContaining({ filename: 'clip01.mp4', body: file }),
      ),
    );
  });
});

describe('AssetLibraryPage montage', () => {
  function renderWithPreviewRoute(client: Partial<RenderApiClient>) {
    render(
      <RenderApiProvider
        client={
          {
            getProject: vi.fn().mockResolvedValue({ slug: 'smoke-ingest' }),
            getHealth: vi.fn().mockResolvedValue(HEALTHY_SERVICE),
            listAssets: vi.fn().mockResolvedValue(listing),
            listGenerated: vi.fn().mockResolvedValue(EMPTY_GENERATED),
            getVoice: vi
              .fn()
              .mockRejectedValue(
                new RenderApiError('VOICE_NOT_FOUND', 'no voice', 404, null),
              ),
            ...client,
          } as RenderApiClient
        }
      >
        <MemoryRouter initialEntries={['/projects/smoke-ingest']}>
          <Routes>
            <Route path="/projects/:slug" element={<AssetLibraryPage />} />
            <Route
              path="/projects/:slug/preview"
              element={<p>preview route</p>}
            />
          </Routes>
        </MemoryRouter>
      </RenderApiProvider>,
    );
  }

  it('offers the montage trigger next to the asset library', async () => {
    renderWithPreviewRoute({});

    await waitFor(() =>
      expect(screen.getByTestId('montage-trigger')).toBeTruthy(),
    );
    expect(
      screen.getByRole('button', { name: 'Generate montage' }),
    ).toBeTruthy();
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
      expect(
        (
          screen.getByRole('button', {
            name: 'Generate montage',
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Generate montage' }));

    await waitFor(() => expect(screen.getByText('preview route')).toBeTruthy());
    expect(getRenderJob).toHaveBeenCalledWith('job-0002');
  });
});

describe('AssetLibraryPage · storyboard', () => {
  it('links to the storyboard of the project next to the preview link', async () => {
    renderPage({ listAssets: vi.fn().mockResolvedValue(listing) });

    await waitFor(() =>
      expect(screen.getByTestId('asset-source')).toBeTruthy(),
    );
    expect(
      screen
        .getByRole('link', { name: 'open storyboard' })
        .getAttribute('href'),
    ).toBe('/projects/smoke-ingest/storyboard');
    expect(
      screen.getByRole('link', { name: 'open voice' }).getAttribute('href'),
    ).toBe('/projects/smoke-ingest/voice');
    expect(
      screen.getByRole('link', { name: 'open preview' }).getAttribute('href'),
    ).toBe('/projects/smoke-ingest/preview');
  });
});

describe('AssetLibraryPage in a motion project', () => {
  const motionProject = { slug: 'smoke-ingest', mode: 'motion' };

  it('keeps the photo uploader and the images, and drops the footage-only controls', async () => {
    const montageCreate = vi.fn();
    renderPage({
      getProject: vi.fn().mockResolvedValue(motionProject),
      listAssets: vi.fn().mockResolvedValue(listing),
      createMontageJob: montageCreate,
    });

    await waitFor(() => expect(cardsOf('image')).toHaveLength(1));
    expect(screen.getByLabelText('Asset file')).toBeTruthy();
    expect(screen.getByLabelText('Upload a photo for the video')).toBeTruthy();
    expect(
      screen.getByText(
        'The photos of the video: they appear in the storyboard scenes that use them.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/B-roll/u)).toBeNull();
    expect(cardsOf('aroll')).toHaveLength(0);
    expect(cardsOf('broll')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /montage/iu })).toBeNull();
    expect(screen.queryByTestId('montage-trigger')).toBeNull();
    expect(montageCreate).not.toHaveBeenCalled();
  });
});
