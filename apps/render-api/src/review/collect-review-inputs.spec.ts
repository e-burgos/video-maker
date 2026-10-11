import { resolveMediaProject } from '@video-maker/auto-montage';
import type { Timeline } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { collectReviewInputs } from './collect-review-inputs';
import type { ReviewInputPorts } from './collect-review-inputs';
import { ReviewInputsUnavailableError } from './review-errors';
import type { ReviewMeasurements } from './review-measurements';
import { reviewRender } from './review-rules';

const project = resolveMediaProject('/media/demo');
const PROBED_AT = '2026-10-11T00:00:00.000Z';

const footageTimeline: Timeline = {
  schemaVersion: 1,
  id: 'timeline-demo',
  format: { preset: 'youtube-16x9', width: 1920, height: 1080, fps: 30 },
  durationFrames: 900,
  assets: [
    { id: 'raw/aroll.mp4', kind: 'video', path: 'raw/aroll.mp4', durationMs: 30_000, fps: 30, width: 1920, height: 1080, rotation: 0, hasAudio: false, videoCodec: 'h264', probedAt: PROBED_AT },
    { id: 'raw/music.mp3', kind: 'audio', path: 'raw/music.mp3', durationMs: 120_000, audio: { sampleRate: 44_100, channels: 2, integratedLufs: -12 }, probedAt: PROBED_AT },
    { id: 'work/voice.wav', kind: 'audio', path: 'work/voice.wav', durationMs: 30_000, audio: { sampleRate: 48_000, channels: 1 }, probedAt: PROBED_AT },
    { id: 'raw/logo.png', kind: 'image', path: 'raw/logo.png', durationMs: 0, probedAt: PROBED_AT },
  ],
  tracks: {
    aroll: [{ id: 'aroll-1', assetId: 'raw/aroll.mp4', from: 0, durationFrames: 900, trimStartMs: 0, transform: { scale: 1, translateX: 0, translateY: 0 }, muted: true }],
    broll: [],
    voice: [{ id: 'voice-1', assetId: 'work/voice.wav', from: 0, durationFrames: 900, trimStartMs: 0, gainDb: 0 }],
    music: [{ id: 'music-1', assetId: 'raw/music.mp3', from: 0, durationFrames: 900, trimStartMs: 0, gainDb: -8 }],
    captions: [
      { id: 'caption-1', from: 30, durationFrames: 60, words: [{ text: 'Hola', fromFrame: 0, durationFrames: 30 }, { text: 'mundo', fromFrame: 30, durationFrames: 30 }], box: { x: 60, y: 60, width: 1800, height: 960 } },
    ],
  },
  audioMix: {
    voice: { integratedLufs: -14, truePeakDbtp: -1, loudnessRange: 11 },
    music: { baseGainDb: -8, duckedGainDb: -18, referenceLufs: -16, attackMs: 150, releaseMs: 400, holdMs: 250 },
    automation: [
      { frame: 0, gainDb: -8 },
      { frame: 28, gainDb: -8 },
      { frame: 32, gainDb: -18 },
      { frame: 212, gainDb: -18 },
      { frame: 224, gainDb: -8 },
      { frame: 400, gainDb: -8 },
      { frame: 402, gainDb: -18 },
    ],
  },
  logo: { assetId: 'raw/logo.png', position: 'bottom-right', widthRatio: 0.2, marginRatio: 0.03, opacity: 1 },
  bumpers: {
    intro: { enabled: true, durationMs: 2000, backgroundColor: '#ffffff', animation: 'zoom', logoWidthRatio: 0.4 },
    outro: { enabled: true, durationMs: 2000, backgroundColor: '#ffffff', animation: 'zoom', logoWidthRatio: 0.4 },
  },
  captionStyle: 'subtle-lower',
};

const motionTimeline = {
  duration: 12,
  scenes: [
    { id: 'hook', start: 0, end: 5, voStart: 0.25, voDuration: 3 },
    { id: 'cta', start: 5, end: 12, voStart: 5.25, voDuration: 4 },
  ],
  musicAutomation: {
    version: 1,
    lanes: [{ target: 'volume', points: [{ t: 0, v: 0 }, { t: 0.6, v: 0.85 }, { t: 5, v: 0.85 }, { t: 12, v: 0 }] }],
  },
};

function withoutFile(files: Record<string, string>, path: string): Record<string, string> {
  return Object.fromEntries(Object.entries(files).filter(([candidate]) => candidate !== path));
}

function storageWith(files: Record<string, string>): ReviewInputPorts['storage'] {
  return {
    stat: (path) => Promise.resolve(path in files ? { kind: 'file' as const } : null),
    readTextFile: (path) => Promise.resolve(files[path] ?? ''),
  };
}

interface FakeMeasurementsInit {
  readonly durationSec: number;
  readonly levels?: (path: string, startSec: number) => number | null;
  readonly master?: { integratedLufs: number; truePeakDbtp: number };
}

function fakeMeasurements(init: FakeMeasurementsInit): ReviewMeasurements {
  return {
    measureMaster: () => Promise.resolve(init.master ?? { integratedLufs: -14, truePeakDbtp: -2 }),
    probeDurationSec: () => Promise.resolve(init.durationSec),
    detectBlack: () => Promise.resolve([]),
    detectFrozen: () => Promise.resolve([]),
    detectSilences: () => Promise.resolve([]),
    measureSegments: (path, segments) =>
      Promise.resolve(segments.map((segment) => init.levels?.(path, segment.startSec) ?? -20)),
  };
}

function footagePorts(init: FakeMeasurementsInit, extraFiles?: Record<string, string>): ReviewInputPorts {
  return {
    storage: storageWith({
      '/media/demo/work/timeline.json': JSON.stringify(footageTimeline),
      '/media/demo/raw/aroll.mp4': 'x',
      '/media/demo/raw/music.mp3': 'x',
      '/media/demo/work/voice.wav': 'x',
      '/media/demo/raw/logo.png': 'x',
      ...extraFiles,
    }),
    measurements: fakeMeasurements(init),
    nowIso: () => '2026-10-11T12:00:00.000Z',
  };
}

describe('collectReviewInputs: footage', () => {
  it('builds normalized inputs with bumper-shifted voice segments, captions and expected duration', async () => {
    const inputs = await collectReviewInputs(
      { project, file: 'out/demo.mp4', mode: 'footage' },
      footagePorts({ durationSec: 34 }),
    );

    expect(inputs.expectedDurationSec).toBe(34);
    expect(inputs.bumpers).toEqual([{ startSec: 0, endSec: 2 }, { startSec: 32, endSec: 34 }]);
    expect(inputs.voiceSegments).toHaveLength(1);
    expect(inputs.voiceSegments[0]?.startSec).toBeCloseTo(3.0667, 3);
    expect(inputs.voiceSegments[0]?.endSec).toBeCloseTo(9.0667, 3);
    expect(inputs.captions).toEqual([
      { id: 'caption-1', startSec: 3, endSec: 5, text: 'Hola mundo', box: { x: 60, y: 60, width: 1800, height: 960 } },
    ]);
    expect(inputs.frame?.safeZone).toEqual({ top: 60, bottom: 60, left: 60, right: 60 });
    expect(inputs.delivery).toEqual({ kind: 'tutorial' });
    expect(inputs.missingAssets).toEqual([]);
    expect(reviewRender(inputs).status).toBe('pass');
  });

  it('applies the music normalization to the declared automation gain', async () => {
    const inputs = await collectReviewInputs(
      { project, file: 'out/demo.mp4', mode: 'footage' },
      footagePorts({ durationSec: 34 }),
    );

    expect(inputs.voiceSegments[0]?.musicGainDb).toBeCloseTo(-4 - 18, 5);
  });

  it('normalizes the voice level to the voice target using the whole asset loudness', async () => {
    const levels = (path: string, startSec: number): number | null => {
      if (path.endsWith('voice.wav')) {
        return startSec === 0 ? -24 : -20;
      }
      return -30;
    };

    const inputs = await collectReviewInputs(
      { project, file: 'out/demo.mp4', mode: 'footage' },
      footagePorts({ durationSec: 34, levels }),
    );

    expect(inputs.voiceSegments[0]?.voiceLufs).toBe(-14 + 4);
  });

  it('reports referenced files that are not on disk', async () => {
    const ports = footagePorts({ durationSec: 34 });
    const withoutMusic: ReviewInputPorts = {
      ...ports,
      storage: { ...ports.storage, stat: (path) => (path.endsWith('music.mp3') ? Promise.resolve(null) : ports.storage.stat(path)) },
    };

    const inputs = await collectReviewInputs({ project, file: 'out/demo.mp4', mode: 'footage' }, withoutMusic);

    expect(inputs.missingAssets).toEqual(['raw/music.mp3']);
  });

  it('infers a short for a vertical timeline within 180 s', async () => {
    const vertical: Timeline = { ...footageTimeline, format: { preset: 'reels-9x16', width: 1080, height: 1920, fps: 30 } };
    const ports = footagePorts({ durationSec: 34 }, { '/media/demo/work/timeline.json': JSON.stringify(vertical) });

    const inputs = await collectReviewInputs({ project, file: 'out/demo.mp4', mode: 'footage' }, ports);

    expect(inputs.delivery).toEqual({ kind: 'short' });
  });

  it('keeps the explicit delivery contract', async () => {
    const explicit: Timeline = { ...footageTimeline, delivery: { kind: 'short', maxDurationSec: 20 } };
    const ports = footagePorts({ durationSec: 34 }, { '/media/demo/work/timeline.json': JSON.stringify(explicit) });

    const inputs = await collectReviewInputs({ project, file: 'out/demo.mp4', mode: 'footage' }, ports);

    expect(inputs.delivery).toEqual({ kind: 'short', maxDurationSec: 20 });
    expect(reviewRender(inputs).status).toBe('fail');
  });

  it('fails clearly when the project has no timeline', async () => {
    const ports: ReviewInputPorts = { ...footagePorts({ durationSec: 34 }), storage: storageWith({}) };

    await expect(collectReviewInputs({ project, file: 'out/demo.mp4', mode: 'footage' }, ports)).rejects.toBeInstanceOf(
      ReviewInputsUnavailableError,
    );
  });
});

describe('collectReviewInputs: motion', () => {
  const motionFiles = {
    '/media/demo/work/motion/timeline.json': JSON.stringify(motionTimeline),
    '/media/demo/work/motion/assets/audio/vo-hook.wav': 'x',
    '/media/demo/work/motion/assets/audio/vo-cta.wav': 'x',
    '/media/demo/work/motion/assets/audio/music.wav': 'x',
  };

  function motionPorts(levels: FakeMeasurementsInit['levels'], files: Record<string, string> = motionFiles): ReviewInputPorts {
    return {
      storage: storageWith(files),
      measurements: fakeMeasurements({ durationSec: 12, ...(levels === undefined ? {} : { levels }) }),
      nowIso: () => '2026-10-11T12:00:00.000Z',
    };
  }

  it('builds one level plan per scene with the 0.8 track volume and the automation level', async () => {
    const inputs = await collectReviewInputs({ project, file: 'out/motion.mp4', mode: 'motion' }, motionPorts(undefined));

    expect(inputs.delivery).toEqual({ kind: 'motion' });
    expect(inputs.expectedDurationSec).toBe(12);
    expect(inputs.voiceSegments.map((segment) => [segment.startSec, segment.endSec])).toEqual([[0.25, 3.25], [5.25, 9.25]]);
    expect(inputs.voiceSegments[0]?.musicGainDb).toBeCloseTo(20 * Math.log10(0.8 * 0.85), 2);
    expect(inputs.bumpers).toEqual([]);
    expect(inputs.captions).toEqual([]);
  });

  it('gives a critical margin for loud music, quiet voice and a 0.15 automation level', async () => {
    const quietDuck = {
      ...motionTimeline,
      musicAutomation: { version: 1, lanes: [{ target: 'volume', points: [{ t: 0, v: 0.15 }, { t: 12, v: 0.15 }] }] },
    };
    const levels = (path: string): number => (path.endsWith('music.wav') ? -12 : -26);
    const ports = motionPorts(levels, { ...motionFiles, '/media/demo/work/motion/timeline.json': JSON.stringify(quietDuck) });

    const report = reviewRender(await collectReviewInputs({ project, file: 'out/motion.mp4', mode: 'motion' }, ports));

    expect(report.status).toBe('fail');
    expect(report.metrics['voiceMusicMarginDb']).toBeCloseTo(4.4, 1);
    expect(report.findings.filter((finding) => finding.check === 'voice-music-margin')).toHaveLength(2);
  });

  it('does not measure music when music.wav does not exist', async () => {
    const withoutMusic = withoutFile(motionFiles, '/media/demo/work/motion/assets/audio/music.wav');

    const inputs = await collectReviewInputs({ project, file: 'out/motion.mp4', mode: 'motion' }, motionPorts(undefined, withoutMusic));

    expect(inputs.voiceSegments.every((segment) => segment.musicLufs === null)).toBe(true);
  });

  it('reports missing voice-over files', async () => {
    const withoutVo = withoutFile(motionFiles, '/media/demo/work/motion/assets/audio/vo-cta.wav');

    const inputs = await collectReviewInputs({ project, file: 'out/motion.mp4', mode: 'motion' }, motionPorts(undefined, withoutVo));

    expect(inputs.missingAssets).toEqual(['work/motion/assets/audio/vo-cta.wav']);
    expect(inputs.hasVoice).toBe(true);
  });
});
