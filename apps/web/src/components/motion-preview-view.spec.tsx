import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { motionOverviewFixture } from '../api/__fixtures__/motion-overview';
import type { MotionOverview } from '../api/motion-types';
import type { RenderApiClient } from '../api/render-api-client';
import { RenderApiProvider } from '../api/render-api-context';
import { MotionPreviewView } from './motion-preview-view';

function renderView(overview: MotionOverview) {
  const client = { getMotionOverview: vi.fn().mockResolvedValue(overview) } as unknown as RenderApiClient;
  const view = render(
    <RenderApiProvider client={client}>
      <MemoryRouter>
        <MotionPreviewView slug="promo" />
      </MemoryRouter>
    </RenderApiProvider>,
  );
  return view.container;
}

describe('MotionPreviewView', () => {
  it('plays the rendered video and shows its path, duration and credits', async () => {
    const container = renderView(motionOverviewFixture());

    const credits = await screen.findByTestId('motion-preview-credits');
    const video = container.querySelector('video');
    expect(video?.getAttribute('src')).toBe('/api/projects/promo/files/out/promo.mp4');
    expect(video?.hasAttribute('controls')).toBe(true);
    expect(screen.getByText(/out\/promo\.mp4 · 30\.0 s/u)).toBeTruthy();
    expect(within(credits).getByText('Música: Drive')).toBeTruthy();
    expect(within(credits).getByText(/publication description/u)).toBeTruthy();
    expect(screen.queryByTestId('motion-preview-outdated')).toBeNull();
  });

  it('warns when the storyboard changed after the last render', async () => {
    renderView(
      motionOverviewFixture({
        video: { ...(motionOverviewFixture().video as NonNullable<MotionOverview['video']>), outdated: true },
      }),
    );

    const note = await screen.findByTestId('motion-preview-outdated');
    expect(note.textContent).toContain('storyboard changed after the last render');
  });

  it('seeks the video to the start of a scene when its button is clicked', async () => {
    const container = renderView(motionOverviewFixture());

    const button = await screen.findByRole('button', { name: 's2 · 8.5–20.0 s' });
    fireEvent.click(button);

    expect((container.querySelector('video') as HTMLVideoElement).currentTime).toBe(8.5);
    expect(within(screen.getByTestId('motion-preview-scenes')).getAllByRole('button')).toHaveLength(3);
  });

  it('points to the Motion page when no video was rendered', async () => {
    const container = renderView(motionOverviewFixture({ video: null }));

    const empty = await screen.findByTestId('motion-preview-empty');
    expect(within(empty).getByRole('link').getAttribute('href')).toBe('/projects/promo/motion');
    expect(container.querySelector('video')).toBeNull();
  });

  it('offers the sample button when a storyboard exists, even before the first render', async () => {
    renderView(motionOverviewFixture({ video: null }));

    expect(await screen.findByRole('button', { name: 'Generate sample (10 s)' })).toBeTruthy();
  });

  it('hides the sample button when there is no storyboard to render', async () => {
    renderView(motionOverviewFixture({ storyboard: null, video: null }));

    await screen.findByTestId('motion-preview-empty');
    expect(screen.queryByRole('button', { name: 'Generate sample (10 s)' })).toBeNull();
  });
});
