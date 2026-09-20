import { describe, expect, it } from 'vitest';

import type { EditDecisionList, LogoBumper, MediaAsset, MusicInput, Timeline } from '@video-maker/timeline-core';
import { buildTimeline } from '@video-maker/timeline-core';

import { buildAudioMixGraph } from './build-audio-mix-graph';
import { shiftTimelineAudioForBumpers } from './shift-timeline-audio-for-bumpers';

const PROBED_AT = new Date('2026-01-01T00:00:00.000Z').toISOString();
const FORMAT = { preset: 'reels-9x16' as const, width: 1080, height: 1920, fps: 30 as const };

const VOICE_ASSET: MediaAsset = {
  id: 'voice-1',
  kind: 'audio',
  path: '/assets/voice.wav',
  durationMs: 7000,
  probedAt: PROBED_AT,
};

const MUSIC_ASSET: MediaAsset = {
  id: 'music-1',
  kind: 'audio',
  path: '/assets/music.mp3',
  durationMs: 7000,
  probedAt: PROBED_AT,
};

const EDL: EditDecisionList = {
  schemaVersion: 1,
  sourceAssetId: 'voice-1',
  format: FORMAT,
  generatedBy: { tool: 'test', params: {} },
  decisions: [
    { id: 'keep-0001', type: 'keep', startMs: 0, endMs: 7000 },
    { id: 'duck-0001', type: 'duck', startMs: 1000, endMs: 3000, gainDb: -24 },
  ],
};

const MUSIC: MusicInput = { assetId: 'music-1', gainDb: -12, fadeInFrames: 15, fadeOutFrames: 30 };

const BUMPER: LogoBumper = {
  enabled: true,
  durationMs: 2000,
  backgroundColor: '#ffffff',
  animation: 'zoom',
  logoWidthRatio: 0.4,
};

const INTRO_FRAMES = 60;
const TOTAL_SECONDS = '11';

function timelineWithBumpers(bumpers: Timeline['bumpers']): Timeline {
  return { ...buildTimeline(EDL, [VOICE_ASSET, MUSIC_ASSET], MUSIC), bumpers };
}

function filtersOf(timeline: Timeline, label: string): readonly string[] {
  const graph = buildAudioMixGraph({ timeline });
  const chain = graph.chains.find((candidate) => candidate.outputLabels.includes(label));
  if (chain === undefined) {
    throw new Error(`the graph has no chain producing ${label}`);
  }
  return chain.filters;
}

describe('shiftTimelineAudioForBumpers', () => {
  it('sin bumpers devuelve la misma Timeline, sin copiarla', () => {
    const timeline = timelineWithBumpers(undefined);

    expect(shiftTimelineAudioForBumpers(timeline)).toBe(timeline);
  });

  it('corre voz, música y automation por los frames del intro y lleva la duración al total', () => {
    const timeline = timelineWithBumpers({ intro: BUMPER, outro: BUMPER });

    const shifted = shiftTimelineAudioForBumpers(timeline);

    expect(shifted.durationFrames).toBe(timeline.durationFrames + 2 * INTRO_FRAMES);
    expect(shifted.tracks.voice.map((clip) => clip.from)).toEqual(
      timeline.tracks.voice.map((clip) => clip.from + INTRO_FRAMES),
    );
    expect(shifted.tracks.music.map((clip) => clip.from)).toEqual(
      timeline.tracks.music.map((clip) => clip.from + INTRO_FRAMES),
    );
    expect(shifted.audioMix.automation.map((keyframe) => keyframe.frame)).toEqual(
      timeline.audioMix.automation.map((keyframe) => keyframe.frame + INTRO_FRAMES),
    );
  });

  it('sólo con outro no corre nada, pero extiende la duración de referencia', () => {
    const timeline = timelineWithBumpers({ outro: BUMPER });

    const shifted = shiftTimelineAudioForBumpers(timeline);

    expect(shifted.tracks.voice[0]?.from).toBe(timeline.tracks.voice[0]?.from);
    expect(shifted.durationFrames).toBe(timeline.durationFrames + INTRO_FRAMES);
  });

  it('un bumper apagado no corre nada', () => {
    const timeline = timelineWithBumpers({ intro: { ...BUMPER, enabled: false } });

    expect(shiftTimelineAudioForBumpers(timeline)).toBe(timeline);
  });
});

describe('buildAudioMixGraph con bumpers', () => {
  it('la voz entra con adelay del intro en milisegundos', () => {
    expect(filtersOf(timelineWithBumpers({ intro: BUMPER }), 'voice0')).toContain('adelay=2000:all=1');
  });

  it('sin bumpers la voz sigue sin delay', () => {
    expect(filtersOf(timelineWithBumpers(undefined), 'voice0')).toContain('adelay=0:all=1');
  });

  it('la cama de música se corre y pad-ea hasta el total, fades incluidos', () => {
    const filters = filtersOf(timelineWithBumpers({ intro: BUMPER, outro: BUMPER }), 'music0');

    expect(filters).toContain('adelay=2000:all=1');
    expect(filters).toContain('afade=t=in:st=2:d=0.5');
    expect(filters).toContain('afade=t=out:st=8:d=1');
    expect(filters).toContain(`apad=whole_dur=${TOTAL_SECONDS}`);
    expect(filters).toContain(`atrim=end=${TOTAL_SECONDS}`);
  });

  it('la automation de ducking se corre con la música', () => {
    const [expression] = filtersOf(timelineWithBumpers({ intro: BUMPER }), 'music0').filter((filter) =>
      filter.startsWith('volume=volume='),
    );

    expect(expression).toContain('gte(t,3)');
    expect(expression).not.toContain('gte(t,1)*');
  });

  it('el amix final pad-ea la mezcla hasta el total, siempre con whole_dur y sin atrim', () => {
    const graph = buildAudioMixGraph({ timeline: timelineWithBumpers({ intro: BUMPER, outro: BUMPER }) });

    expect(graph.chains.at(-1)?.filters).toEqual([
      'amix=inputs=2:duration=longest:normalize=0',
      `apad=whole_dur=${TOTAL_SECONDS}`,
    ]);
  });

  it('sin bumpers el amix final es exactamente el de antes', () => {
    const graph = buildAudioMixGraph({ timeline: timelineWithBumpers(undefined) });

    expect(graph.chains.at(-1)?.filters).toEqual(['amix=inputs=2:duration=longest:normalize=0']);
  });
});
