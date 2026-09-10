import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import type { EditDecisionList, MediaAsset, MusicInput } from '@video-maker/timeline-core';
import { buildTimeline } from '@video-maker/timeline-core';

import { buildLoudnormFilter } from '../ffmpeg/build-loudnorm-filter';
import type { LoudnessMeasurement } from '../ffmpeg/parse-loudnorm-json';
import { UnresolvedAudioAssetError } from '../errors/unresolved-audio-asset-error';
import { buildAudioMixGraph } from './build-audio-mix-graph';

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

const EDL_WITH_DUCKING: EditDecisionList = {
  schemaVersion: 1,
  sourceAssetId: 'voice-1',
  format: FORMAT,
  generatedBy: { tool: 'test', params: {} },
  decisions: [
    { id: 'keep-0001', type: 'keep', startMs: 0, endMs: 7000 },
    { id: 'duck-0001', type: 'duck', startMs: 1000, endMs: 3000, gainDb: -24 },
    { id: 'duck-0002', type: 'duck', startMs: 5000, endMs: 6000, gainDb: -24 },
  ],
};

const EDL_WITHOUT_DUCKING: EditDecisionList = {
  schemaVersion: 1,
  sourceAssetId: 'voice-1',
  format: FORMAT,
  generatedBy: { tool: 'test', params: {} },
  decisions: [{ id: 'keep-0001', type: 'keep', startMs: 0, endMs: 7000 }],
};

const MUSIC_WITH_FADES: MusicInput = { assetId: 'music-1', gainDb: -12, fadeInFrames: 15, fadeOutFrames: 30 };
const MUSIC_IDENTITY: MusicInput = { assetId: 'music-1', gainDb: 0 };

const EXPECTED_MUSIC_EXPRESSION =
  "volume=volume='min(1,pow(10,(lt(t,0)*(-12)+gte(t,0)*lt(t,0.866666667)*((-12)+(0)*(t-0))+gte(t,0.866666667)*lt(t,1)*((-12)+(-90)*(t-0.866666667))+gte(t,1)*lt(t,3.266666667)*((-24)+(0)*(t-1))+gte(t,3.266666667)*lt(t,3.666666667)*((-24)+(30)*(t-3.266666667))+gte(t,3.666666667)*lt(t,4.866666667)*((-12)+(0)*(t-3.666666667))+gte(t,4.866666667)*lt(t,5)*((-12)+(-90)*(t-4.866666667))+gte(t,5)*lt(t,6.266666667)*((-24)+(0)*(t-5))+gte(t,6.266666667)*lt(t,6.666666667)*((-24)+(30)*(t-6.266666667))+gte(t,6.666666667)*(-12))/20))':eval=frame";

function buildFixtureTimeline() {
  return buildTimeline(EDL_WITH_DUCKING, [VOICE_ASSET, MUSIC_ASSET], MUSIC_WITH_FADES);
}

describe('buildAudioMixGraph', () => {
  it('con la Timeline real de §9.1 (armada con buildTimeline) produce el FilterGraph exacto de §9.2', () => {
    const timeline = buildFixtureTimeline();

    const graph = buildAudioMixGraph({ timeline });

    expect(graph).toEqual({
      inputs: ['/assets/voice.wav', '/assets/music.mp3'],
      chains: [
        {
          inputLabels: ['0:a'],
          filters: [
            'atrim=start=0:end=7',
            'asetpts=PTS-STARTPTS',
            'adelay=0:all=1',
            'loudnorm=I=-14:TP=-1:LRA=11:print_format=json',
            'aresample=48000',
          ],
          outputLabels: ['voice0'],
        },
        {
          inputLabels: ['1:a'],
          filters: [
            'atrim=start=0:end=7',
            'asetpts=PTS-STARTPTS',
            'adelay=0:all=1',
            EXPECTED_MUSIC_EXPRESSION,
            'afade=t=in:st=0:d=0.5',
            'afade=t=out:st=6:d=1',
            'apad=whole_dur=7',
            'atrim=end=7',
          ],
          outputLabels: ['music0'],
        },
        {
          inputLabels: ['voice0', 'music0'],
          filters: [
            'amix=inputs=2:duration=longest:normalize=0',
            'asetpts=N/SR/TB',
            'apad=whole_dur=7',
            'atrim=end=7',
          ],
          outputLabels: ['mix'],
        },
      ],
      outputLabel: 'mix',
    });
  });

  it('el amix final siempre lleva normalize=0 con un unico outputLabel', () => {
    const timeline = buildFixtureTimeline();

    const graph = buildAudioMixGraph({ timeline });
    const amixChain = graph.chains.at(-1);

    expect(amixChain?.filters[0]).toBe('amix=inputs=2:duration=longest:normalize=0');
    expect(graph.outputLabel).toBe('mix');
  });

  it('estira la mezcla hasta durationFrames para que el mux con -shortest no recorte el video', () => {
    const timeline = buildFixtureTimeline();
    const shorterVoice = {
      ...timeline,
      durationFrames: timeline.durationFrames + 30,
      tracks: { ...timeline.tracks, music: [] },
    };

    const graph = buildAudioMixGraph({ timeline: shorterVoice });
    const targetSeconds = (timeline.durationFrames + 30) / timeline.format.fps;

    expect(graph.chains.at(-1)?.filters).toEqual([
      'amix=inputs=1:duration=longest:normalize=0',
      'asetpts=N/SR/TB',
      `apad=whole_dur=${targetSeconds}`,
      `atrim=end=${targetSeconds}`,
    ]);
  });

  it('reconstruye el reloj de la mezcla antes de rellenar, porque loudnorm desfasa el PTS', () => {
    const graph = buildAudioMixGraph({ timeline: buildFixtureTimeline() });
    const filters = graph.chains.at(-1)?.filters ?? [];

    expect(filters.indexOf('asetpts=N/SR/TB')).toBeGreaterThan(0);
    expect(filters.findIndex((filter) => filter.startsWith('apad'))).toBe(
      filters.indexOf('asetpts=N/SR/TB') + 1,
    );
  });

  it('acota TODO apad del grafo con whole_dur: un apad sin límite genera silencio infinito', () => {
    const timeline = buildFixtureTimeline();
    const targetSeconds = timeline.durationFrames / timeline.format.fps;

    for (const graph of [
      buildAudioMixGraph({ timeline }),
      buildAudioMixGraph({ timeline: { ...timeline, tracks: { ...timeline.tracks, music: [] } } }),
    ]) {
      const padFilters = graph.chains.flatMap((chain) =>
        chain.filters.filter((filter) => filter.startsWith('apad')),
      );

      expect(padFilters.length).toBeGreaterThan(0);
      padFilters.forEach((filter) => {
        expect(filter).toBe(`apad=whole_dur=${targetSeconds}`);
      });
    }
  });

  it('con voiceMeasuredByAssetId usa buildLoudnormFilter de segunda pasada indexado por assetId', () => {
    const timeline = buildFixtureTimeline();
    const measured: LoudnessMeasurement = {
      integratedLufs: -23.45,
      truePeakDbtp: -5.2,
      loudnessRange: 7.6,
      thresholdLufs: -33.99,
      targetOffsetDb: -0.03,
    };

    const graph = buildAudioMixGraph({
      timeline,
      voiceMeasuredByAssetId: new Map([['voice-1', measured]]),
    });

    expect(graph.chains[0]?.filters).toContain(buildLoudnormFilter(timeline.audioMix.voice, measured));
  });

  it('la identidad de la curva no produce un nodo volume redundante en el grafo (CA-001)', () => {
    const timeline = buildTimeline(EDL_WITHOUT_DUCKING, [VOICE_ASSET, MUSIC_ASSET], MUSIC_IDENTITY);

    const graph = buildAudioMixGraph({ timeline });
    const musicChain = graph.chains[1];

    expect(musicChain?.filters.some((filter) => filter.startsWith('volume='))).toBe(false);
  });

  it('un assetId de voz inexistente lanza UnresolvedAudioAssetError con el assetId en el mensaje (CA-005, R-19)', () => {
    const timeline = buildFixtureTimeline();
    const broken = { ...timeline, assets: timeline.assets.filter((asset) => asset.id !== 'voice-1') };

    expect(() => buildAudioMixGraph({ timeline: broken })).toThrow(UnresolvedAudioAssetError);

    try {
      buildAudioMixGraph({ timeline: broken });
      expect.unreachable('se esperaba que buildAudioMixGraph lanzara');
    } catch (error) {
      expect(error).toBeInstanceOf(UnresolvedAudioAssetError);
      expect((error as UnresolvedAudioAssetError).assetId).toBe('voice-1');
      expect((error as UnresolvedAudioAssetError).track).toBe('voice');
      expect((error as Error).message).toContain('voice-1');
    }
  });

  it('un assetId de musica inexistente lanza UnresolvedAudioAssetError con track music', () => {
    const timeline = buildFixtureTimeline();
    const broken = { ...timeline, assets: timeline.assets.filter((asset) => asset.id !== 'music-1') };

    try {
      buildAudioMixGraph({ timeline: broken });
      expect.unreachable('se esperaba que buildAudioMixGraph lanzara');
    } catch (error) {
      expect(error).toBeInstanceOf(UnresolvedAudioAssetError);
      expect((error as UnresolvedAudioAssetError).track).toBe('music');
      expect((error as Error).message).toContain('music-1');
    }
  });

  it('una Timeline sin ningun clip de audio lanza ZodError, no el error tipado nuevo (D-09)', () => {
    const timeline = buildFixtureTimeline();
    const withoutAudio = { ...timeline, tracks: { ...timeline.tracks, voice: [], music: [] } };

    expect(() => buildAudioMixGraph({ timeline: withoutAudio })).toThrow(ZodError);
  });
});
