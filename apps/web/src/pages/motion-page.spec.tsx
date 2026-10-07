import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { MotionPage } from './motion-page';
import { RenderApiProvider } from '../api/render-api-context';
import { RenderApiError } from '../api/render-api-error';
import type { RenderApiClient } from '../api/render-api-client';
import type { MotionBrief, MotionJob } from '../api/motion-types';

const BRANDS = [
  {
    id: 'displayads',
    name: 'DisplayAds',
    formats: ['16:9', '9:16'],
    music: [{ id: 'drive', mood: 'energetic', bpm: 120, hasDrop: true }],
  },
  { id: 'other', name: 'Other', formats: ['16:9'], music: [] },
];

const STORYBOARD = {
  version: 1,
  title: 'Promo',
  brand: 'displayads',
  format: '16:9',
  beatSync: true,
  music: 'auto',
  scenes: [
    { id: 's1', kind: 'hero', vo: 'Hello world', chapter: 'Intro', props: {} },
    { id: 's2', kind: 'outro', vo: 'Bye', props: {} },
  ],
};

function motionJob(patch: Partial<MotionJob>): MotionJob {
  return {
    id: 'job-1',
    kind: 'motion',
    slug: 'promo',
    state: 'succeeded',
    createdAt: '2026-10-07T00:00:00Z',
    startedAt: null,
    finishedAt: null,
    progress: null,
    report: null,
    error: null,
    ...patch,
  };
}

function notFound(code: string): RenderApiError {
  return new RenderApiError(code, 'missing', 404, null);
}

function imageAsset(name: string) {
  return {
    path: `raw/images/${name}`,
    role: 'image',
    fingerprint: { sizeBytes: 1, modifiedAtMs: 1 },
    media: null,
  };
}

function renderPage(client: Partial<RenderApiClient>) {
  const defaults: Partial<RenderApiClient> = {
    getMotionBrands: vi.fn().mockResolvedValue(BRANDS),
    getMotionBrief: vi.fn().mockRejectedValue(notFound('BRIEF_NOT_FOUND')),
    getMotionStoryboard: vi.fn().mockRejectedValue(notFound('STORYBOARD_NOT_FOUND')),
    listAssets: vi.fn().mockResolvedValue({
      slug: 'promo',
      source: 'raw-scan',
      assets: [imageAsset('a.png'), imageAsset('b.png')],
      probeFailures: [],
    }),
    putMotionBrief: vi.fn().mockImplementation(async (_slug: string, brief: MotionBrief) => brief),
    ...client,
  };
  render(
    <RenderApiProvider client={defaults as RenderApiClient}>
      <MemoryRouter initialEntries={['/projects/promo/motion']}>
        <Routes>
          <Route path="/projects/:slug/motion" element={<MotionPage />} />
        </Routes>
      </MemoryRouter>
    </RenderApiProvider>,
  );
  return defaults as RenderApiClient;
}

async function fillScript(text: string) {
  fireEvent.change(await screen.findByLabelText('Script'), { target: { value: text } });
}

describe('MotionPage', () => {
  it('starts from defaults when no brief exists', async () => {
    renderPage({});

    expect(((await screen.findByLabelText('Brand')) as HTMLSelectElement).value).toBe('displayads');
    expect((screen.getByRole('radio', { name: '16:9' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Music') as HTMLSelectElement).value).toBe('auto');
    expect((screen.getByLabelText('Sync scenes to the beat') as HTMLInputElement).checked).toBe(true);
  });

  it('loads an existing brief into the form', async () => {
    renderPage({
      getMotionBrief: vi.fn().mockResolvedValue({
        version: 1,
        brand: 'other',
        format: '16:9',
        beatSync: false,
        music: null,
        title: 'Saved title',
        script: 'Saved script',
        images: [{ file: 'a.png', caption: 'A caption' }],
      }),
    });

    expect(((await screen.findByLabelText('Script')) as HTMLTextAreaElement).value).toBe('Saved script');
    expect((screen.getByLabelText('Brand') as HTMLSelectElement).value).toBe('other');
    expect((screen.getByLabelText('Music') as HTMLSelectElement).value).toBe('none');
    expect((screen.getByLabelText('Use a.png') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('What a.png shows') as HTMLInputElement).value).toBe('A caption');
    expect((screen.getByLabelText('Use b.png') as HTMLInputElement).checked).toBe(false);
  });

  it('saves the exact brief body', async () => {
    const client = renderPage({});
    await fillScript('My script');
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Promo' } });
    fireEvent.click(screen.getByRole('radio', { name: '9:16' }));
    fireEvent.change(screen.getByLabelText('Music'), { target: { value: 'drive' } });
    fireEvent.click(screen.getByLabelText('Use b.png'));
    fireEvent.change(screen.getByLabelText('What b.png shows'), { target: { value: 'Dashboard' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(client.putMotionBrief).toHaveBeenCalled());
    const [slug, body] = (client.putMotionBrief as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      MotionBrief,
    ];
    expect(slug).toBe('promo');
    expect(Object.keys(body).sort()).toEqual(
      ['beatSync', 'brand', 'format', 'images', 'music', 'script', 'title', 'version'].sort(),
    );
    expect(body).toEqual({
      version: 1,
      brand: 'displayads',
      title: 'Promo',
      format: '9:16',
      beatSync: true,
      music: 'drive',
      script: 'My script',
      images: [{ file: 'b.png', caption: 'Dashboard' }],
    });
  });

  it('refuses an empty script without calling the API', async () => {
    const client = renderPage({});
    await screen.findByLabelText('Script');

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Write the script before continuing.')).toBeTruthy();
    expect(client.putMotionBrief).not.toHaveBeenCalled();
  });

  it('shows the server validation error next to the form', async () => {
    renderPage({
      putMotionBrief: vi.fn().mockRejectedValue(
        new RenderApiError('BRIEF_INVALID', 'images[0].file is not in raw/images', 400, {
          code: 'BRIEF_INVALID',
          stage: null,
          message: 'images[0].file is not in raw/images',
          expected: 'a file in raw/images',
        }),
      ),
    });
    await fillScript('Script');

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('BRIEF_INVALID');
    expect(alert.textContent).toContain('images[0].file');
  });

  it('runs the storyboard phase and lists the scenes with the job stats', async () => {
    const getMotionStoryboard = vi
      .fn()
      .mockRejectedValueOnce(notFound('STORYBOARD_NOT_FOUND'))
      .mockResolvedValue(STORYBOARD);
    const createMotionJob = vi.fn().mockResolvedValue(motionJob({ state: 'queued' }));
    const getRenderJob = vi.fn().mockResolvedValue(
      motionJob({
        report: {
          path: null,
          durationSec: null,
          scenes: 2,
          storyboard: { repaired: true, tokensIn: 1200, tokensOut: 340, costUsd: 0.0123 },
        },
      }),
    );
    renderPage({ getMotionStoryboard, createMotionJob, getRenderJob });
    await fillScript('Script');

    fireEvent.click(screen.getByRole('button', { name: 'Build storyboard' }));

    await waitFor(() => expect(screen.getAllByTestId('motion-scene')).toHaveLength(2));
    expect(createMotionJob).toHaveBeenCalledWith('promo', { phase: 'storyboard', overwrite: true });
    expect(screen.getByText(/Hello world/)).toBeTruthy();
    expect(screen.getAllByTestId('motion-scene')[0]?.textContent).toContain('hero');
    expect(screen.getByTestId('motion-storyboard-stats').textContent).toBe(
      'storyboard: 2 scenes · repaired yes · 1200 in / 340 out tokens · $0.0123',
    );
    expect(screen.queryByTestId('motion-video')).toBeNull();
  });

  it('shows voice stage progress while the video job runs', async () => {
    const createMotionJob = vi.fn().mockResolvedValue(motionJob({ state: 'running' }));
    const getRenderJob = vi.fn().mockResolvedValue(
      motionJob({ state: 'running', progress: { stage: 'voice', linesVoiced: 3, totalLines: 8 } }),
    );
    renderPage({ createMotionJob, getRenderJob });
    await fillScript('Script');

    fireEvent.click(screen.getByRole('button', { name: 'Make video' }));

    expect((await screen.findByTestId('motion-job-stage')).textContent).toBe('Voice 3/8');
    expect(createMotionJob).toHaveBeenCalledWith('promo', {
      phase: 'all',
      overwrite: true,
      output: 'video.mp4',
    });
  });

  it('uses the video phase when a storyboard exists and shows the player on success', async () => {
    const createMotionJob = vi.fn().mockResolvedValue(motionJob({ state: 'queued' }));
    const getRenderJob = vi.fn().mockResolvedValue(
      motionJob({
        report: { path: 'out/video.mp4', durationSec: 42, scenes: 2, musicCredit: '"Tema" Autor · CC BY 4.0', storyboard: null },
      }),
    );
    renderPage({
      getMotionStoryboard: vi.fn().mockResolvedValue(STORYBOARD),
      createMotionJob,
      getRenderJob,
    });
    await fillScript('Script');
    await screen.findAllByTestId('motion-scene');

    fireEvent.click(screen.getByRole('button', { name: 'Make video' }));

    const player = await screen.findByTestId('motion-video');
    expect(createMotionJob).toHaveBeenCalledWith('promo', {
      phase: 'video',
      overwrite: true,
      output: 'video.mp4',
    });
    expect(player.querySelector('video')?.getAttribute('src')).toBe(
      '/api/projects/promo/files/out/video.mp4',
    );
    expect(player.textContent).toContain('out/video.mp4 · 42s');
    expect(screen.getByTestId('motion-music-credit').textContent).toBe('For the post description: Music: "Tema" Autor · CC BY 4.0');
  });
});
