import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { voiceTrack } from '../api/__fixtures__/voice';
import { RenderApiProvider } from '../api/render-api-context';
import { RenderApiError } from '../api/render-api-error';
import {
  VoiceSceneCard,
  durationDelta,
  formatSeconds,
  takeFileName,
} from './voice-scene-card';
import type { RenderApiClient } from '../api/render-api-client';
import type { VoiceSceneStatus, VoiceTrack } from '../api/render-api-types';

type Overrides = {
  status?: Partial<VoiceSceneStatus>;
  track?: Partial<VoiceTrack>;
  narration?: string | null;
  estimatedDurationMs?: number | null;
  takes?: readonly string[];
  attachVoiceTake?: RenderApiClient['attachVoiceTake'];
  uploadAsset?: RenderApiClient['uploadAsset'];
};

function renderCard(overrides: Overrides = {}) {
  const onRegenerate = vi.fn();
  const onAttached = vi.fn();
  const onTakeUploaded = vi.fn();
  const attachVoiceTake =
    overrides.attachVoiceTake ??
    (vi.fn().mockResolvedValue({
      slug: 'smoke-ingest',
      path: 'work/voice/manifest.json',
      track: voiceTrack({ source: 'uploaded', voiceId: null }),
    }) as unknown as RenderApiClient['attachVoiceTake']);
  const uploadAsset =
    overrides.uploadAsset ??
    (vi.fn().mockResolvedValue({ path: 'raw/voice/take-03.wav' }) as unknown as RenderApiClient['uploadAsset']);

  render(
    <RenderApiProvider client={{ attachVoiceTake, uploadAsset } as unknown as RenderApiClient}>
      <ul>
        <VoiceSceneCard
          slug="smoke-ingest"
          status={{ sceneId: 'scene-01', index: 1, source: 'generated', stale: false, ...overrides.status }}
          track={voiceTrack(overrides.track ?? {})}
          narration={overrides.narration === undefined ? 'Primero: Ctrl+R.' : overrides.narration}
          estimatedDurationMs={
            overrides.estimatedDurationMs === undefined ? 5000 : overrides.estimatedDurationMs
          }
          takes={overrides.takes ?? ['take-01.wav', 'take-03.wav']}
          onRegenerate={onRegenerate}
          onAttached={onAttached}
          onTakeUploaded={onTakeUploaded}
        />
      </ul>
    </RenderApiProvider>,
  );

  return { onRegenerate, onAttached, onTakeUploaded, attachVoiceTake, uploadAsset };
}

describe('takeFileName', () => {
  it('keeps only the file name of a project-relative asset path', () => {
    expect(takeFileName('raw/voice/take-03.wav')).toBe('take-03.wav');
    expect(takeFileName('take-03.wav')).toBe('take-03.wav');
    expect(takeFileName('')).toBe('');
  });
});

describe('formatSeconds and durationDelta', () => {
  it('reads a millisecond duration as seconds with two decimals', () => {
    expect(formatSeconds(3100)).toBe('3.10 s');
    expect(formatSeconds(0)).toBe('0.00 s');
  });

  it('signs the gap against the estimate in both directions', () => {
    expect(durationDelta(5561, 4000)).toBe('+1.56 s vs the estimate');
    expect(durationDelta(3100, 5000)).toBe('−1.90 s vs the estimate');
    expect(durationDelta(3100, null)).toBeNull();
  });
});

describe('VoiceSceneCard', () => {
  it('plays the track of the scene from the file route of the service', () => {
    renderCard();

    const audio = screen.getByLabelText('Voice track of scene-01') as HTMLAudioElement;
    expect(audio.getAttribute('src')).toBe('/api/projects/smoke-ingest/files/work/voice/scene-01.wav');
    expect(audio.tagName).toBe('AUDIO');
    expect(audio.hasAttribute('controls')).toBe(true);
  });

  it('shows the measured duration against the one the model estimated', () => {
    renderCard({ track: { durationMs: 5561 }, estimatedDurationMs: 4000 });

    const duration = screen.getByTestId('voice-duration-scene-01').textContent ?? '';
    expect(duration).toContain('real 5.56 s');
    expect(duration).toContain('estimated 4.00 s');
    expect(duration).toContain('+1.56 s vs the estimate');
  });

  it('says so when the storyboard carries no estimate for the scene', () => {
    renderCard({ estimatedDurationMs: null });

    expect(screen.getByTestId('voice-duration-scene-01').textContent).toContain(
      'no estimate in the storyboard',
    );
  });

  it('names the voice of a generated track and the origin of an uploaded one', () => {
    const { onRegenerate } = renderCard();
    expect(screen.getByTestId('voice-source-scene-01').textContent).toBe(
      'generated · es_AR-daniela-high',
    );
    expect(onRegenerate).not.toHaveBeenCalled();
  });

  it('marks an uploaded track as the developer own recording', () => {
    renderCard({
      status: { source: 'uploaded' },
      track: { source: 'uploaded', voiceId: null },
    });

    expect(screen.getByTestId('voice-source-scene-01').textContent).toBe(
      'uploaded · my own recording',
    );
    expect(screen.getByTestId('voice-scene-scene-01').getAttribute('data-voice-source')).toBe(
      'uploaded',
    );
  });

  it('flags a stale scene with the reason and regenerates only that one', () => {
    const { onRegenerate } = renderCard({ status: { stale: true } });

    expect(screen.getByTestId('voice-stale-scene-01').textContent).toContain('old script');
    expect(screen.getByTestId('voice-scene-scene-01').getAttribute('data-voice-stale')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Regenerate this scene' }));

    expect(onRegenerate).toHaveBeenCalledWith('scene-01');
  });

  it('explains a scene the storyboard no longer has instead of calling it fresh', () => {
    renderCard({ status: { stale: null } });

    expect(screen.getByText(/no longer part of the storyboard/)).toBeDefined();
    expect(screen.queryByTestId('voice-stale-scene-01')).toBeNull();
  });

  it('attaches a take that was already uploaded, defaulting to the first one', async () => {
    const { attachVoiceTake, onAttached } = renderCard();

    fireEvent.click(screen.getByRole('button', { name: 'Use this take' }));

    await waitFor(() =>
      expect(attachVoiceTake).toHaveBeenCalledWith('smoke-ingest', 'scene-01', 'take-01.wav'),
    );
    await waitFor(() => expect(onAttached).toHaveBeenCalledTimes(1));
  });

  it('attaches the take the user picked from raw/voice/', async () => {
    const { attachVoiceTake } = renderCard();

    fireEvent.change(screen.getByLabelText('Recorded take for scene-01'), {
      target: { value: 'take-03.wav' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Use this take' }));

    await waitFor(() =>
      expect(attachVoiceTake).toHaveBeenCalledWith('smoke-ingest', 'scene-01', 'take-03.wav'),
    );
  });

  it('cannot attach anything when raw/voice/ is empty', () => {
    renderCard({ takes: [] });

    expect((screen.getByRole('button', { name: 'Use this take' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((screen.getByLabelText('Recorded take for scene-01') as HTMLSelectElement).disabled).toBe(
      true,
    );
  });

  it('uploads a recording with the voice role and attaches it to this scene in one move', async () => {
    const { uploadAsset, attachVoiceTake, onTakeUploaded, onAttached } = renderCard({ takes: [] });

    fireEvent.change(screen.getByLabelText('Upload a take for scene-01'), {
      target: { files: [new File(['bytes'], 'my-take.wav', { type: 'audio/wav' })] },
    });

    await waitFor(() =>
      expect(uploadAsset).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'voice', filename: 'my-take.wav' }),
      ),
    );
    await waitFor(() =>
      expect(attachVoiceTake).toHaveBeenCalledWith('smoke-ingest', 'scene-01', 'take-03.wav'),
    );
    expect(onTakeUploaded).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onAttached).toHaveBeenCalledTimes(1));
  });

  it('keeps the service code on screen next to its explanation when the attach fails', async () => {
    const attachVoiceTake = vi
      .fn()
      .mockRejectedValue(
        new RenderApiError('VOICE_ASSET_NOT_FOUND', 'not under raw/voice/', 404, null),
      ) as unknown as RenderApiClient['attachVoiceTake'];
    const { onAttached } = renderCard({ attachVoiceTake });

    fireEvent.click(screen.getByRole('button', { name: 'Use this take' }));

    await waitFor(() =>
      expect(screen.getByTestId('voice-attach-explanation-scene-01')).toBeDefined(),
    );
    expect(screen.getByText(/VOICE_ASSET_NOT_FOUND/)).toBeDefined();
    expect(onAttached).not.toHaveBeenCalled();
  });
});
