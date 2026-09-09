import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { GainKeyframe } from '@video-maker/timeline-core';
import { volumeAtFrame } from '../helpers/audio-gain';
import type { AudioSequenceProps } from '../helpers/timeline-to-sequence-props';

const capturedAudioProps: Record<string, unknown>[] = [];

vi.mock('remotion', async () => {
  const { createElement: create } = await import('react');

  return {
    Sequence: (props: { children?: unknown }) => props.children,
    Audio: (props: Record<string, unknown>) => {
      capturedAudioProps.push(props);
      return create('div', { 'data-component': 'Audio' });
    },
  };
});

const { AudioTrack } = await import('./audio-track');

function clip(
  overrides: Partial<AudioSequenceProps> & Pick<AudioSequenceProps, 'clipId'>,
): AudioSequenceProps {
  return {
    assetId: 'raw/audio/music01.mp3',
    src: 'https://studio.local/api/music01.mp3',
    from: 0,
    durationInFrames: 300,
    trimStartMs: 0,
    trimBefore: 0,
    gainDb: -12,
    volume: 1,
    fadeInFrames: null,
    fadeOutFrames: null,
    ...overrides,
  };
}

describe('AudioTrack', () => {
  it('emits volumeAtFrame(automation, frameInClip + clip.from) for a music clip, never gainDbToVolume(baseGainDb/duckedGainDb)', () => {
    capturedAudioProps.length = 0;
    const automation: GainKeyframe[] = [
      { frame: 0, gainDb: -12 },
      { frame: 30, gainDb: -24 },
      { frame: 60, gainDb: -12 },
    ];
    const musicClip = clip({ clipId: 'music-0001', from: 100, volume: 0.5 });

    renderToStaticMarkup(createElement(AudioTrack, { voice: [], music: [musicClip], automation }));

    const volume = capturedAudioProps[0]?.['volume'];
    expect(typeof volume).toBe('function');
    const volumeFn = volume as (frameInClip: number) => number;

    expect(volumeFn(0)).toBeCloseTo(volumeAtFrame(automation, 0 + musicClip.from), 9);
    expect(volumeFn(45)).toBeCloseTo(volumeAtFrame(automation, 45 + musicClip.from), 9);
  });

  it('falls back to clip.volume for a music clip when automation is empty', () => {
    capturedAudioProps.length = 0;
    const musicClip = clip({ clipId: 'music-0001', volume: 0.73 });

    renderToStaticMarkup(createElement(AudioTrack, { voice: [], music: [musicClip], automation: [] }));

    expect(capturedAudioProps[0]?.['volume']).toBe(0.73);
  });

  it('always uses clip.volume directly for voice clips, regardless of automation', () => {
    capturedAudioProps.length = 0;
    const voiceClip = clip({ clipId: 'voice-0001', volume: 1 });
    const automation: GainKeyframe[] = [{ frame: 0, gainDb: -12 }];

    renderToStaticMarkup(createElement(AudioTrack, { voice: [voiceClip], music: [], automation }));

    expect(capturedAudioProps[0]?.['volume']).toBe(1);
  });

  it('renders one Sequence-backed Audio per voice and per music clip, keyed by clipId', () => {
    capturedAudioProps.length = 0;
    const voiceClip = clip({ clipId: 'voice-0001' });
    const musicClip = clip({ clipId: 'music-0001' });

    const markup = renderToStaticMarkup(
      createElement(AudioTrack, { voice: [voiceClip], music: [musicClip], automation: [] }),
    );

    expect(capturedAudioProps).toHaveLength(2);
    expect(markup.match(/data-component="Audio"/g)).toHaveLength(2);
  });
});
