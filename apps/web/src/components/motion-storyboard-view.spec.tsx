import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { motionOverviewFixture } from '../api/__fixtures__/motion-overview';
import type { MotionOverview } from '../api/motion-types';
import type { RenderApiClient } from '../api/render-api-client';
import { RenderApiProvider } from '../api/render-api-context';
import { MotionStoryboardView, groupScenesByChapter } from './motion-storyboard-view';

function renderView(overview: MotionOverview) {
  const client = { getMotionOverview: vi.fn().mockResolvedValue(overview) } as unknown as RenderApiClient;
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
