import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { motionOverviewFixture } from '../api/__fixtures__/motion-overview';
import type { MotionOverview } from '../api/motion-types';
import type { RenderApiClient } from '../api/render-api-client';
import { RenderApiProvider } from '../api/render-api-context';
import { MotionVoiceView } from './motion-voice-view';

function renderView(overview: MotionOverview) {
  const client = { getMotionOverview: vi.fn().mockResolvedValue(overview) } as unknown as RenderApiClient;
  render(
    <RenderApiProvider client={client}>
      <MemoryRouter>
        <MotionVoiceView slug="promo" />
      </MemoryRouter>
    </RenderApiProvider>,
  );
}

describe('MotionVoiceView', () => {
  it('lists a card per scene with its line, voice, duration and audio player', async () => {
    renderView(motionOverviewFixture());

    const cards = await screen.findAllByTestId('motion-voice-scene');
    expect(cards).toHaveLength(3);
    const first = within(cards[0] as HTMLElement);
    expect(first.getByText('Encontrá tu casa')).toBeTruthy();
    expect(first.getByText('Voice: es-AR-Elena')).toBeTruthy();
    expect(first.getByText('3.4 s')).toBeTruthy();
    const audio = (cards[0] as HTMLElement).querySelector('audio');
    expect(audio?.getAttribute('src')).toBe('/api/projects/promo/files/work/motion/voice/s1.mp3');
    expect(audio?.hasAttribute('controls')).toBe(true);
  });

  it('marks only the stale scenes, explains the re-synthesis and shows the text that was spoken', async () => {
    renderView(motionOverviewFixture());

    const cards = await screen.findAllByTestId('motion-voice-scene');
    expect(screen.getAllByTestId('motion-voice-stale')).toHaveLength(1);
    const stale = within(cards[1] as HTMLElement);
    expect(stale.getByText('out of date')).toBeTruthy();
    expect(stale.getByText(/re-synthesized on the next render/u)).toBeTruthy();
    expect(stale.getByText('Spoken text: Con fotos')).toBeTruthy();
    expect(within(cards[0] as HTMLElement).queryByTestId('motion-voice-stale')).toBeNull();
  });

  it('says there is no audio yet for a scene without a take, and offers no synthesis controls', async () => {
    renderView(motionOverviewFixture());

    const cards = await screen.findAllByTestId('motion-voice-scene');
    expect((cards[2] as HTMLElement).querySelector('audio')).toBeNull();
    expect(within(cards[2] as HTMLElement).getByText('There is no audio for this scene yet.')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByLabelText(/upload/iu)).toBeNull();
  });

  it('explains the voice is generated when rendering from Motion when there is none', async () => {
    renderView(motionOverviewFixture({ voice: null }));

    const empty = await screen.findByTestId('motion-voice-empty');
    expect(within(empty).getByText('The voice is generated when the video is rendered from Motion.')).toBeTruthy();
    expect(within(empty).getByRole('link').getAttribute('href')).toBe('/projects/promo/motion');
  });
});
