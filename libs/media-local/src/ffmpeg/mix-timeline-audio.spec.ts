import { describe, expect, it } from 'vitest';

import type { EditDecisionList, MediaAsset, MusicInput } from '@video-maker/timeline-core';
import { buildTimeline } from '@video-maker/timeline-core';

import { readFixture } from '../__fixtures__/load-fixture';
import { CommandFailedError } from '../errors/command-failed-error';
import { MissingMediaStreamError } from '../errors/missing-media-stream-error';
import { UnresolvedAudioAssetError } from '../errors/unresolved-audio-asset-error';
import { audioMixFfmpegArgs } from '../mix/audio-mix-ffmpeg-args';
import { buildAudioMixGraph } from '../mix/build-audio-mix-graph';
import { serializeFilterGraph } from '../mix/serialize-filter-graph';
import { FixtureCommandRunner } from '../runner/fixture-command-runner';
import { withMasterBusLimiter } from './master-bus-limiter';
import { mixTimelineAudio } from './mix-timeline-audio';
import type { LoudnessMeasurement } from './parse-loudnorm-json';

const loudnormStderr = readFixture('ffmpeg/loudnorm.stderr.txt');

const EXPECTED_MEASUREMENT: LoudnessMeasurement = {
  integratedLufs: -23.45,
  truePeakDbtp: -5.2,
  loudnessRange: 7.6,
  thresholdLufs: -33.99,
  targetOffsetDb: -0.03,
};

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

const MUSIC_WITH_FADES: MusicInput = { assetId: 'music-1', gainDb: -12, fadeInFrames: 15, fadeOutFrames: 30 };

function buildFixtureTimeline() {
  return buildTimeline(EDL_WITH_DUCKING, [VOICE_ASSET, MUSIC_ASSET], MUSIC_WITH_FADES);
}

function measurementRunner(): FixtureCommandRunner {
  return new FixtureCommandRunner([
    { bin: 'ffmpeg', argsPattern: ['-f', 'null'], response: { stderr: loudnormStderr, exitCode: 0 } },
    { bin: 'ffmpeg', argsPattern: ['-filter_complex'], response: { stderr: '', exitCode: 0 } },
  ]);
}

describe('mixTimelineAudio (RF-2-01, CA-008, D-12/D-13/D-15/D-21)', () => {
  it('ejecuta exactamente 2 invocaciones para la Timeline canonica de buildTimeline (1 asset de voz)', async () => {
    const timeline = buildFixtureTimeline();
    const runner = measurementRunner();

    const result = await mixTimelineAudio(timeline, '/out/master.wav', runner);

    expect(runner.calls).toHaveLength(2);
    expect(result.voiceMeasured).toEqual(new Map([['voice-1', EXPECTED_MEASUREMENT]]));
    expect(result.outputPath).toBe('/out/master.wav');
  });

  it('la primera invocacion mide el asset de voz completo con -map 0:a:0, sin depender del clip (D-15/§4.2)', async () => {
    const timeline = buildFixtureTimeline();
    const runner = measurementRunner();

    await mixTimelineAudio(timeline, '/out/master.wav', runner);

    expect(runner.calls[0]?.args).toEqual([
      '-hide_banner',
      '-nostats',
      '-i',
      '/assets/voice.wav',
      '-map',
      '0:a:0',
      '-af',
      'loudnorm=I=-14:TP=-1:LRA=11:print_format=json',
      '-f',
      'null',
      '-',
    ]);
  });

  it('la segunda invocacion usa el grafo real con la voz en segunda pasada (measured) y el master bus apendeado (D-13/D-21)', async () => {
    const timeline = buildFixtureTimeline();
    const runner = measurementRunner();

    const result = await mixTimelineAudio(timeline, '/out/master.wav', runner);

    const expectedMixGraph = buildAudioMixGraph({
      timeline,
      voiceMeasuredByAssetId: new Map([['voice-1', EXPECTED_MEASUREMENT]]),
    });
    const expectedGraph = withMasterBusLimiter(expectedMixGraph, timeline.audioMix.voice);
    const expectedArgs = audioMixFfmpegArgs(expectedGraph, '/out/master.wav');

    expect(runner.calls[1]?.args).toEqual(expectedArgs);
    expect(result.args).toEqual(expectedArgs);
    expect(result.filterComplex).toBe(serializeFilterGraph(expectedGraph));
  });

  it('el filterComplex final incluye level=disabled y termina en [master] (D-21)', async () => {
    const timeline = buildFixtureTimeline();
    const runner = measurementRunner();

    const result = await mixTimelineAudio(timeline, '/out/master.wav', runner);

    expect(result.filterComplex).toContain('level=disabled');
    expect(result.filterComplex.endsWith('[master]')).toBe(true);
  });

  it('la voz del grafo real lleva measured_/linear=true: es la segunda pasada, no la primera (D-13)', async () => {
    const timeline = buildFixtureTimeline();
    const runner = measurementRunner();

    const result = await mixTimelineAudio(timeline, '/out/master.wav', runner);

    expect(result.filterComplex).toContain('measured_I=-23.45');
    expect(result.filterComplex).toContain('linear=true');
  });

  it('con dos assets de voz distintos ejecuta N+1 = 3 invocaciones, una medicion por asset (D-12, CA-008 caso general)', async () => {
    const base = buildFixtureTimeline();
    const secondVoiceAsset: MediaAsset = {
      id: 'voice-2',
      kind: 'audio',
      path: '/assets/voice-2.wav',
      durationMs: 7000,
      probedAt: PROBED_AT,
    };
    const [firstVoiceClip] = base.tracks.voice;
    if (firstVoiceClip === undefined) {
      throw new Error('fixture invalida: buildFixtureTimeline no produjo clips de voz');
    }
    const secondVoiceClip = { ...firstVoiceClip, id: 'voice-clip-2', assetId: 'voice-2' };
    const timeline = {
      ...base,
      assets: [...base.assets, secondVoiceAsset],
      tracks: { ...base.tracks, voice: [...base.tracks.voice, secondVoiceClip] },
    };
    const runner = measurementRunner();

    await mixTimelineAudio(timeline, '/out/master.wav', runner);

    expect(runner.calls).toHaveLength(3);
    expect(runner.calls[0]?.args).toContain('/assets/voice.wav');
    expect(runner.calls[1]?.args).toContain('/assets/voice-2.wav');
  });

  it('deduplica por assetId: dos clips del mismo asset de voz siguen midiendo una sola vez', async () => {
    const base = buildFixtureTimeline();
    const [firstVoiceClip] = base.tracks.voice;
    if (firstVoiceClip === undefined) {
      throw new Error('fixture invalida: buildFixtureTimeline no produjo clips de voz');
    }
    const duplicateVoiceClip = { ...firstVoiceClip, id: 'voice-clip-dup' };
    const timeline = { ...base, tracks: { ...base.tracks, voice: [...base.tracks.voice, duplicateVoiceClip] } };
    const runner = measurementRunner();

    await mixTimelineAudio(timeline, '/out/master.wav', runner);

    expect(runner.calls).toHaveLength(2);
  });

  it('mezcla la voz desde un wav propio aunque el A-roll sea un video mudo (FIX-e-burgos-007-002)', async () => {
    const silentAroll: MediaAsset = {
      id: 'raw/aroll/screen.mp4',
      kind: 'video',
      path: '/assets/screen.mp4',
      durationMs: 7000,
      fps: 30,
      width: 1920,
      height: 1080,
      hasAudio: false,
      probedAt: PROBED_AT,
    };
    const scriptVoice: MediaAsset = {
      id: 'work/voice/voice.wav',
      kind: 'audio',
      path: 'work/voice/voice.wav',
      durationMs: 7000,
      probedAt: PROBED_AT,
    };
    const timeline = buildTimeline(
      { ...EDL_WITH_DUCKING, sourceAssetId: silentAroll.id },
      [silentAroll, scriptVoice],
      undefined,
      undefined,
      { assetId: scriptVoice.id },
    );
    const runner = measurementRunner();

    const result = await mixTimelineAudio(timeline, '/out/master.wav', runner);

    expect(result.voiceMeasured).toEqual(new Map([['work/voice/voice.wav', EXPECTED_MEASUREMENT]]));
    expect(runner.calls[0]?.args).toContain('work/voice/voice.wav');
    expect(result.args).toContain('work/voice/voice.wav');
    expect(result.args).not.toContain('/assets/screen.mp4');
  });

  it('un asset de voz sin stream de audio lanza MissingMediaStreamError antes de invocar el runner (TASK-001)', async () => {
    const base = buildFixtureTimeline();
    const voiceAssetWithoutAudio: MediaAsset = {
      id: 'voice-1',
      kind: 'video',
      path: '/assets/voice.mp4',
      durationMs: 7000,
      fps: 30,
      width: 1080,
      height: 1920,
      hasAudio: false,
      probedAt: PROBED_AT,
    };
    const timeline = {
      ...base,
      assets: base.assets.map((asset) => (asset.id === 'voice-1' ? voiceAssetWithoutAudio : asset)),
    };
    const runner = measurementRunner();

    await expect(mixTimelineAudio(timeline, '/out/master.wav', runner)).rejects.toBeInstanceOf(
      MissingMediaStreamError,
    );
    expect(runner.calls).toHaveLength(0);
  });

  it('un asset de voz kind=audio sin hasAudio explicito sigue midiendo (predicado kind==="audio", no hasAudio!==false)', async () => {
    const timeline = buildFixtureTimeline();
    const runner = measurementRunner();

    await expect(mixTimelineAudio(timeline, '/out/master.wav', runner)).resolves.toBeDefined();
  });

  it('un assetId de voz inexistente lanza UnresolvedAudioAssetError antes de invocar el runner', async () => {
    const base = buildFixtureTimeline();
    const timeline = { ...base, assets: base.assets.filter((asset) => asset.id !== 'voice-1') };
    const runner = measurementRunner();

    await expect(mixTimelineAudio(timeline, '/out/master.wav', runner)).rejects.toBeInstanceOf(
      UnresolvedAudioAssetError,
    );
    expect(runner.calls).toHaveLength(0);
  });

  it('un assetId de musica inexistente lanza UnresolvedAudioAssetError con track music en el gate, antes de medir (D-13)', async () => {
    const base = buildFixtureTimeline();
    const timeline = { ...base, assets: base.assets.filter((asset) => asset.id !== 'music-1') };
    const runner = measurementRunner();

    try {
      await mixTimelineAudio(timeline, '/out/master.wav', runner);
      expect.unreachable('se esperaba que mixTimelineAudio rechazara');
    } catch (error) {
      expect(error).toBeInstanceOf(UnresolvedAudioAssetError);
      expect((error as UnresolvedAudioAssetError).track).toBe('music');
    }
    expect(runner.calls).toHaveLength(0);
  });

  it('propaga CommandFailedError con el stderr cuando la invocacion de mix falla', async () => {
    const timeline = buildFixtureTimeline();
    const runner = new FixtureCommandRunner([
      { bin: 'ffmpeg', argsPattern: ['-f', 'null'], response: { stderr: loudnormStderr, exitCode: 0 } },
      { bin: 'ffmpeg', argsPattern: ['-filter_complex'], response: { stderr: 'disk full', exitCode: 1 } },
    ]);

    await expect(mixTimelineAudio(timeline, '/out/master.wav', runner)).rejects.toBeInstanceOf(CommandFailedError);
    expect(runner.calls).toHaveLength(2);
  });

  it('propaga CommandFailedError cuando la medicion de voz falla, sin llegar a la invocacion de mix', async () => {
    const timeline = buildFixtureTimeline();
    const runner = new FixtureCommandRunner([
      { bin: 'ffmpeg', argsPattern: ['-f', 'null'], response: { stderr: 'Invalid data found', exitCode: 1 } },
    ]);

    await expect(mixTimelineAudio(timeline, '/out/master.wav', runner)).rejects.toBeInstanceOf(CommandFailedError);
    expect(runner.calls).toHaveLength(1);
  });

  it('respeta ffmpegPath y runOptions en ambas invocaciones', async () => {
    const timeline = buildFixtureTimeline();
    const runner = new FixtureCommandRunner([
      {
        bin: '/opt/homebrew/bin/ffmpeg',
        argsPattern: ['-f', 'null'],
        response: { stderr: loudnormStderr, exitCode: 0 },
      },
      {
        bin: '/opt/homebrew/bin/ffmpeg',
        argsPattern: ['-filter_complex'],
        response: { stderr: '', exitCode: 0 },
      },
    ]);

    await mixTimelineAudio(timeline, '/out/master.wav', runner, {
      ffmpegPath: '/opt/homebrew/bin/ffmpeg',
      runOptions: { timeoutMs: 5000 },
    });

    expect(runner.calls[0]?.bin).toBe('/opt/homebrew/bin/ffmpeg');
    expect(runner.calls[0]?.opts).toEqual({ timeoutMs: 5000 });
    expect(runner.calls[1]?.opts).toEqual({ timeoutMs: 5000 });
  });
});
