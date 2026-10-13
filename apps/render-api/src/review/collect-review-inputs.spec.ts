import { resolveMediaProject } from '@video-maker/auto-montage';
import type { Timeline } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { createFakeReviewMeasurements } from '../__fixtures__/fake-review-measurements';
import type { FakeReviewMeasurementsInit } from '../__fixtures__/fake-review-measurements';
import { footageTimeline, motionTimeline } from '../__fixtures__/review-project-fixtures';
import { collectReviewInputs } from './collect-review-inputs';
import type { ReviewInputPorts } from './collect-review-inputs';
import { ReviewInputsUnavailableError } from './review-errors';
import { reviewRender } from './review-rules';

const project = resolveMediaProject('/media/demo');
function withoutFile(files: Record<string, string>, path: string): Record<string, string> {
  return Object.fromEntries(Object.entries(files).filter(([candidate]) => candidate !== path));
}

function storageWith(files: Record<string, string>): ReviewInputPorts['storage'] {
  return {
    stat: (path) => Promise.resolve(path in files ? { kind: 'file' as const } : null),
    readTextFile: (path) => Promise.resolve(files[path] ?? ''),
    ensureDirectory: () => Promise.resolve(),
  };
}

type FakeMeasurementsInit = FakeReviewMeasurementsInit;

const fakeMeasurements = createFakeReviewMeasurements;

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

  describe('scene frames and delivery promise (US-023-603)', () => {
    const storyboard = JSON.stringify({ scenes: [{ id: 'hook', vo: '  ¿Querés sumar pantallas?  ' }, { id: 'cta' }] });
    const proposal = JSON.stringify({
      version: 1,
      status: 'approved',
      recommendedId: 'directo',
      approvedConceptId: 'directo',
      approvedAt: '2026-10-12T09:00:00.000Z',
      concepts: [
        { id: 'directo', title: 'Directo', angle: 'Al grano', format: 'youtube-16x9', durationSec: 60, scenes: 2, delivery: { kind: 'motion', maxDurationSec: 80 } },
        { id: 'largo', title: 'Largo', angle: 'Detallado', format: 'youtube-16x9', durationSec: 120, scenes: 4, delivery: { kind: 'motion' } },
      ],
    });

    function recordingPorts(files: Record<string, string>) {
      const extracted: Array<{ atSec: number; outPath: string; maxLongSidePx: number }> = [];
      const base = motionPorts(undefined, { ...motionFiles, ...files });
      const ports: ReviewInputPorts = {
        ...base,
        measurements: {
          ...base.measurements,
          extractFrame: (_video, atSec, outPath, maxLongSidePx) => {
            extracted.push({ atSec, outPath, maxLongSidePx });
            return Promise.resolve();
          },
        },
      };
      return { ports, extracted };
    }

    it('extracts one frame for a short scene and several for a long one, and carries the scene voice', async () => {
      const { ports, extracted } = recordingPorts({ '/media/demo/motion/storyboard.json': storyboard });

      const inputs = await collectReviewInputs({ project, file: 'out/motion.mp4', mode: 'motion' }, ports);

      expect(extracted).toEqual([
        { atSec: 2.5, outPath: '/media/demo/out/motion.review/scene-01.jpg', maxLongSidePx: 960 },
        { atSec: 5 + (7 * 0.5) / 3, outPath: '/media/demo/out/motion.review/scene-02-f1.jpg', maxLongSidePx: 960 },
        { atSec: 8.5, outPath: '/media/demo/out/motion.review/scene-02-f2.jpg', maxLongSidePx: 960 },
        { atSec: 5 + (7 * 2.5) / 3, outPath: '/media/demo/out/motion.review/scene-02-f3.jpg', maxLongSidePx: 960 },
      ]);
      expect(inputs.sceneFrames).toEqual([
        { sceneId: 'hook', index: 1, startSec: 0, endSec: 5, frames: [{ atSec: 2.5, frame: 'out/motion.review/scene-01.jpg' }], voice: '¿Querés sumar pantallas?' },
        {
          sceneId: 'cta',
          index: 2,
          startSec: 5,
          endSec: 12,
          frames: [
            { atSec: 5 + (7 * 0.5) / 3, frame: 'out/motion.review/scene-02-f1.jpg' },
            { atSec: 8.5, frame: 'out/motion.review/scene-02-f2.jpg' },
            { atSec: 5 + (7 * 2.5) / 3, frame: 'out/motion.review/scene-02-f3.jpg' },
          ],
        },
      ]);
      expect(reviewRender(inputs).findings.some((finding) => finding.check === 'visual-not-reviewed')).toBe(true);
    });

    it('takes the voice that was actually synthesized over an older storyboard', async () => {
      const staleStoryboard = JSON.stringify({ scenes: [{ id: 'hook', vo: 'Una frase vieja que ya no se dice.' }] });
      const voiceManifest = JSON.stringify({ hook: { vo: '¿Querés sumar pantallas?' } });
      const { ports } = recordingPorts({
        '/media/demo/motion/storyboard.json': staleStoryboard,
        '/media/demo/work/motion/voice-manifest.json': voiceManifest,
      });

      const inputs = await collectReviewInputs({ project, file: 'out/motion.mp4', mode: 'motion' }, ports);

      expect(inputs.sceneFrames[0]?.voice).toBe('¿Querés sumar pantallas?');
    });

    it('still extracts frames when the storyboard is missing, without voice text', async () => {
      const { ports } = recordingPorts({});

      const inputs = await collectReviewInputs({ project, file: 'out/motion.mp4', mode: 'motion' }, ports);

      expect(inputs.sceneFrames.map((frame) => frame.voice)).toEqual([undefined, undefined]);
    });

    it('reads the approved concept as the delivery promise', async () => {
      const { ports } = recordingPorts({ '/media/demo/work/producer/proposal.json': proposal });

      const inputs = await collectReviewInputs({ project, file: 'out/motion.mp4', mode: 'motion' }, ports);

      expect(inputs.promise).toEqual({ conceptId: 'directo', title: 'Directo', durationSec: 60, maxDurationSec: 80 });
    });

    it('has no promise for a pending proposal or an unreadable one', async () => {
      const pending = JSON.stringify({ ...JSON.parse(proposal), status: 'pending', approvedConceptId: undefined, approvedAt: undefined });

      for (const contents of [pending, '{not json']) {
        const { ports } = recordingPorts({ '/media/demo/work/producer/proposal.json': contents });
        const inputs = await collectReviewInputs({ project, file: 'out/motion.mp4', mode: 'motion' }, ports);
        expect(inputs.promise).toBeNull();
      }
    });

    it('has no scene frames for a footage render', async () => {
      const inputs = await collectReviewInputs({ project, file: 'out/demo.mp4', mode: 'footage' }, footagePorts({ durationSec: 34 }));

      expect(inputs.sceneFrames).toEqual([]);
    });
  });
});
