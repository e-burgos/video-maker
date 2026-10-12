import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { motionOverviewFixture } from '../api/__fixtures__/motion-overview';
import type { MotionOverview } from '../api/motion-types';
import type { RenderApiClient } from '../api/render-api-client';
import { RenderApiProvider } from '../api/render-api-context';
import { MotionStoryboardView, groupScenesByChapter } from './motion-storyboard-view';

function renderView(overview: MotionOverview, extra: Partial<RenderApiClient> = {}) {
  const client = {
    getMotionOverview: vi.fn().mockResolvedValue(overview),
    ...extra,
  } as unknown as RenderApiClient;
  render(
    <RenderApiProvider client={client}>
      <MemoryRouter>
        <MotionStoryboardView slug="promo" />
      </MemoryRouter>
    </RenderApiProvider>,
  );
  return client;
}

describe('MotionStoryboardView', () => {
  it('shows the header with brand, format, beat sync and music', async () => {
    const client = renderView(motionOverviewFixture());

    const header = await screen.findByTestId('motion-storyboard-header');
    expect(client.getMotionOverview).toHaveBeenCalledWith('promo');
    expect(within(header).getByText('Promo de casas')).toBeTruthy();
    expect(within(header).getByText('Brand: displayads')).toBeTruthy();
    expect(within(header).getByText('Format: 16:9')).toBeTruthy();
    expect(within(header).getByText('Synced to the beat')).toBeTruthy();
    expect(within(header).getByText('Music: drive · volume 15 %')).toBeTruthy();
  });

  it('groups the scenes by chapter and shows the voice line and duration of each', async () => {
    renderView(motionOverviewFixture());

    const scenes = await screen.findAllByTestId('motion-storyboard-scene');
    expect(scenes).toHaveLength(3);
    expect(screen.getAllByTestId('motion-storyboard-chapter').map((el) => el.textContent)).toEqual([
      'Intro',
      'Cierre',
    ]);
    expect(within(scenes[0] as HTMLElement).getByText('Encontrá tu casa')).toBeTruthy();
    expect(within(scenes[0] as HTMLElement).getByTestId('motion-scene-duration').textContent).toBe('8.5 s');
  });

  it('renders text props, images as thumbnails and brand references as chips', async () => {
    renderView(motionOverviewFixture());

    const [first] = await screen.findAllByTestId('motion-storyboard-scene');
    const scene = within(first as HTMLElement);
    expect(scene.getByText('Tu casa ideal')).toBeTruthy();
    expect(scene.getByText('Rápido')).toBeTruthy();
    expect(scene.getByText('Simple')).toBeTruthy();
    expect(scene.getByTestId('motion-brand-chip').textContent).toBe('logo-main');
    expect(scene.getByRole('img', { name: 'casa.jpg' }).getAttribute('src')).toBe(
      '/api/projects/promo/files/work/motion/images/casa.jpg',
    );
    expect(scene.queryByText('3')).toBeNull();
  });

  it('offers to adjust with the producer', async () => {
    renderView(motionOverviewFixture());

    const link = await screen.findByRole('link', { name: 'Adjust with the producer' });
    expect(link.getAttribute('href')).toBe('/projects/promo');
  });

  it('points to the Motion page when there is no storyboard yet', async () => {
    renderView(motionOverviewFixture({ storyboard: null, timeline: null }));

    const empty = await screen.findByTestId('motion-storyboard-empty');
    expect(within(empty).getByRole('link').getAttribute('href')).toBe('/projects/promo/motion');
  });

  it('surfaces a load failure', async () => {
    const client = {
      getMotionOverview: vi.fn().mockRejectedValue(new Error('down')),
    } as unknown as RenderApiClient;
    render(
      <RenderApiProvider client={client}>
        <MemoryRouter>
          <MotionStoryboardView slug="promo" />
        </MemoryRouter>
      </RenderApiProvider>,
    );

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  });
});

describe('groupScenesByChapter', () => {
  it('opens a new group whenever the chapter changes', () => {
    const scene = (id: string, chapter?: string) => ({ id, kind: 'k', vo: '', props: {}, ...(chapter === undefined ? {} : { chapter }) });
    const groups = groupScenesByChapter([scene('a', 'x'), scene('b', 'x'), scene('c'), scene('d', 'x')]);

    expect(groups.map((group) => [group.chapter, group.scenes.length])).toEqual([
      ['x', 2],
      [null, 1],
      ['x', 1],
    ]);
  });
});

function withMusic(music: NonNullable<MotionOverview['storyboard']>['music']): MotionOverview {
  const base = motionOverviewFixture();
  return { ...base, storyboard: { ...(base.storyboard as NonNullable<MotionOverview['storyboard']>), music } };
}

function sceneNamed(sceneId: string): HTMLElement {
  const scene = screen
    .getAllByTestId('motion-storyboard-scene')
    .find((candidate) => within(candidate).queryByRole('combobox', { name: `Pace of scene ${sceneId}` }) !== null);
  return scene as HTMLElement;
}

describe('MotionStoryboardView — dirección y música por tramos', () => {
  it('shows the direction of each scene and flags the directed ones', async () => {
    const base = motionOverviewFixture();
    const storyboard = base.storyboard as NonNullable<MotionOverview['storyboard']>;
    const directed = {
      ...base,
      storyboard: {
        ...storyboard,
        scenes: storyboard.scenes.map((scene) =>
          scene.id === 's2' ? { ...scene, direction: { pace: 'slow' as const, emphasis: ['fotos'] } } : scene,
        ),
      },
    };
    renderView(directed);

    await screen.findAllByTestId('motion-storyboard-scene');
    const second = within(sceneNamed('s2'));
    expect((second.getByRole('combobox', { name: 'Pace of scene s2' }) as HTMLSelectElement).value).toBe('slow');
    expect(second.getByRole('button', { name: 'fotos' }).getAttribute('aria-pressed')).toBe('true');
    expect(second.getByTestId('motion-direction-badge')).toBeTruthy();
    expect(within(sceneNamed('s1')).queryByTestId('motion-direction-badge')).toBeNull();
    expect(screen.getByTestId('motion-direction-count').textContent).toBe('Scenes with direction: 1');
  });

  it('saves the whole storyboard with the direction of the edited scene', async () => {
    const putMotionStoryboard = vi.fn().mockResolvedValue({});
    renderView(motionOverviewFixture(), { putMotionStoryboard });

    await screen.findAllByTestId('motion-storyboard-scene');
    const save = screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    const first = within(sceneNamed('s1'));
    fireEvent.change(first.getByRole('combobox', { name: 'Pace of scene s1' }), { target: { value: 'slow' } });
    fireEvent.change(first.getByRole('spinbutton', { name: 'Pause after scene s1 (ms)' }), { target: { value: '500' } });
    fireEvent.click(first.getByRole('button', { name: 'casa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(putMotionStoryboard).toHaveBeenCalledTimes(1));
    const [slug, saved] = putMotionStoryboard.mock.calls[0] as [string, NonNullable<MotionOverview['storyboard']>];
    expect(slug).toBe('promo');
    expect(saved.scenes[0]?.direction).toEqual({ pace: 'slow', pauseAfterMs: 500, emphasis: ['casa'] });
    expect(saved.scenes[1]?.direction).toBeUndefined();
    expect(saved.music).toEqual({ track: 'drive', volume: 0.15 });
  });

  it('removes the direction from the saved scene when the dev clears it', async () => {
    const base = motionOverviewFixture();
    const storyboard = base.storyboard as NonNullable<MotionOverview['storyboard']>;
    const putMotionStoryboard = vi.fn().mockResolvedValue({});
    renderView(
      {
        ...base,
        storyboard: {
          ...storyboard,
          scenes: storyboard.scenes.map((scene) =>
            scene.id === 's1' ? { ...scene, direction: { energy: 'lively' as const } } : scene,
          ),
        },
      },
      { putMotionStoryboard },
    );

    await screen.findAllByTestId('motion-storyboard-scene');
    fireEvent.click(within(sceneNamed('s1')).getByRole('button', { name: 'Clear direction of scene s1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(putMotionStoryboard).toHaveBeenCalledTimes(1));
    const saved = putMotionStoryboard.mock.calls[0]?.[1] as NonNullable<MotionOverview['storyboard']>;
    expect('direction' in (saved.scenes[0] as object)).toBe(false);
  });

  it('switches the music to segments with a floor and saves it', async () => {
    const putMotionStoryboard = vi.fn().mockResolvedValue({});
    renderView(withMusic({ track: 'drive', volume: 0.15 }), { putMotionStoryboard });

    await screen.findAllByTestId('motion-storyboard-scene');
    expect((screen.getByRole('combobox', { name: 'Music mode' }) as HTMLSelectElement).value).toBe('bed');
    expect(screen.queryByLabelText('Music floor while speaking (dB)')).toBeNull();

    fireEvent.change(screen.getByRole('combobox', { name: 'Music mode' }), { target: { value: 'segments' } });
    fireEvent.change(screen.getByLabelText('Music floor while speaking (dB)'), { target: { value: '-20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(putMotionStoryboard).toHaveBeenCalledTimes(1));
    const saved = putMotionStoryboard.mock.calls[0]?.[1] as NonNullable<MotionOverview['storyboard']>;
    expect(saved.music).toEqual({ track: 'drive', volume: 0.15, mode: 'segments', floorDb: -20 });
  });

  it('reads the stored segments mode and floor, and goes back to the bed without leaving fields behind', async () => {
    const putMotionStoryboard = vi.fn().mockResolvedValue({});
    renderView(withMusic({ track: 'drive', mode: 'segments', floorDb: -24 }), { putMotionStoryboard });

    await screen.findAllByTestId('motion-storyboard-scene');
    expect((screen.getByLabelText('Music floor while speaking (dB)') as HTMLInputElement).value).toBe('-24');

    fireEvent.change(screen.getByRole('combobox', { name: 'Music mode' }), { target: { value: 'bed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(putMotionStoryboard).toHaveBeenCalledTimes(1));
    const saved = putMotionStoryboard.mock.calls[0]?.[1] as NonNullable<MotionOverview['storyboard']>;
    expect(saved.music).toEqual({ track: 'drive' });
  });

  it('does not save while the floor is out of range', async () => {
    renderView(withMusic({ track: 'drive' }));

    await screen.findAllByTestId('motion-storyboard-scene');
    fireEvent.change(screen.getByRole('combobox', { name: 'Music mode' }), { target: { value: 'segments' } });
    fireEvent.change(screen.getByLabelText('Music floor while speaking (dB)'), { target: { value: '-80' } });

    expect((screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Regenerate video with the changes' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('alert').textContent).toContain('between -60 and -6 dB');
  });

  it('saves pending changes and then regenerates the video overwriting it', async () => {
    const calls: string[] = [];
    const putMotionStoryboard = vi.fn().mockImplementation(async () => {
      calls.push('put');
      return {};
    });
    const createMotionJob = vi.fn().mockImplementation(async () => {
      calls.push('job');
      return { id: 'job-9', kind: 'motion', slug: 'promo', state: 'queued', createdAt: '', startedAt: null, finishedAt: null, progress: null, report: null, error: null };
    });
    const getRenderJob = vi.fn().mockResolvedValue({ id: 'job-9', kind: 'motion', slug: 'promo', state: 'running', createdAt: '', startedAt: null, finishedAt: null, progress: null, report: null, error: null });
    renderView(motionOverviewFixture(), { putMotionStoryboard, createMotionJob, getRenderJob });

    await screen.findAllByTestId('motion-storyboard-scene');
    fireEvent.change(within(sceneNamed('s3')).getByRole('combobox', { name: 'Energy of scene s3' }), { target: { value: 'calm' } });
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate video with the changes' }));

    await waitFor(() => expect(createMotionJob).toHaveBeenCalledWith('promo', { phase: 'video', overwrite: true }));
    expect(calls).toEqual(['put', 'job']);
    expect(await screen.findByTestId('motion-job-status')).toBeTruthy();
  });

  it('does not regenerate when saving fails', async () => {
    const putMotionStoryboard = vi.fn().mockRejectedValue(new Error('down'));
    const createMotionJob = vi.fn();
    renderView(motionOverviewFixture(), { putMotionStoryboard, createMotionJob });

    await screen.findAllByTestId('motion-storyboard-scene');
    fireEvent.change(within(sceneNamed('s3')).getByRole('combobox', { name: 'Energy of scene s3' }), { target: { value: 'calm' } });
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate video with the changes' }));

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(createMotionJob).not.toHaveBeenCalled();
  });
});
