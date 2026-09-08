import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import { buildMinimalTimeline } from '../__fixtures__/minimal-timeline';
import { runRenderPipeline } from './run-render-pipeline';

const PROJECT_ROOT = '/var/data/media/acme-launch';
const RENDER_ID = 'r-2026-09-08-01';
const WORK_DIR_PATH = `${PROJECT_ROOT}/work/renders/${RENDER_ID}`;
const MUTED_VIDEO_PATH = `${WORK_DIR_PATH}/video-muted.mp4`;
const MASTER_AUDIO_PATH = `${WORK_DIR_PATH}/master.wav`;
const OUT_DIR_PATH = `${PROJECT_ROOT}/out`;
const DELIVERABLE_PATH = `${OUT_DIR_PATH}/${RENDER_ID}.mp4`;

const KNOWN_PORTS = [
  'renderMutedVideo',
  'mixTimelineAudio',
  'muxAudioIntoVideo',
  'verifyMixLoudness',
  'ensureDirectory',
  'probeMediaBinaries',
  'preloadEngineModules',
];

describe('runRenderPipeline', () => {
  it('invokes render, mix, mux and verify in that exact order', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog);

    await runRenderPipeline({ renderId: RENDER_ID, projectRoot: PROJECT_ROOT, timeline: buildMinimalTimeline() }, deps);

    expect(callLog.ports()).toEqual([
      'ensureDirectory',
      'ensureDirectory',
      'renderMutedVideo',
      'mixTimelineAudio',
      'muxAudioIntoVideo',
      'verifyMixLoudness',
    ]);
  });

  it('asks the render port for the muted video path and the project root as publicDir', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog);
    const timeline = buildMinimalTimeline();

    await runRenderPipeline({ renderId: RENDER_ID, projectRoot: PROJECT_ROOT, timeline }, deps);

    const renderCall = callLog.entries().find((entry) => entry.port === 'renderMutedVideo');
    if (renderCall === undefined) {
      throw new Error('expected a renderMutedVideo call');
    }

    expect(renderCall.input).toEqual({
      timeline,
      outPath: MUTED_VIDEO_PATH,
      publicDir: PROJECT_ROOT,
    });
  });

  it('feeds the mux with the rendered video and the mixed master, in that order', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog);

    await runRenderPipeline({ renderId: RENDER_ID, projectRoot: PROJECT_ROOT, timeline: buildMinimalTimeline() }, deps);

    const muxCall = callLog.entries().find((entry) => entry.port === 'muxAudioIntoVideo');
    if (muxCall === undefined) {
      throw new Error('expected a muxAudioIntoVideo call');
    }

    expect(muxCall.input).toEqual({
      videoPath: MUTED_VIDEO_PATH,
      audioPath: MASTER_AUDIO_PATH,
      outPath: DELIVERABLE_PATH,
    });
  });

  it('creates the work directory and the out directory before the first stage', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog);

    await runRenderPipeline({ renderId: RENDER_ID, projectRoot: PROJECT_ROOT, timeline: buildMinimalTimeline() }, deps);

    const ensureDirectoryInputs = callLog
      .entries()
      .filter((entry) => entry.port === 'ensureDirectory')
      .map((entry) => entry.input);

    expect(ensureDirectoryInputs).toEqual([WORK_DIR_PATH, OUT_DIR_PATH]);
    expect(callLog.ports().indexOf('ensureDirectory')).toBeLessThan(callLog.ports().indexOf('renderMutedVideo'));
  });

  it('uses WORKDIR_UNWRITABLE as the fallback code when the prepare stage fails', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog, {
      ensureDirectory: async () => {
        throw new Error('EACCES');
      },
    });

    await expect(
      runRenderPipeline({ renderId: RENDER_ID, projectRoot: PROJECT_ROOT, timeline: buildMinimalTimeline() }, deps),
    ).rejects.toMatchObject({ code: 'WORKDIR_UNWRITABLE', stage: 'prepare' });

    expect(callLog.ports()).toEqual(['ensureDirectory']);
  });

  it('never invokes a delete on any path, including when a later stage throws', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog, {
      muxAudioIntoVideo: async () => {
        throw new Error('ENOSPC');
      },
    });

    await expect(
      runRenderPipeline({ renderId: RENDER_ID, projectRoot: PROJECT_ROOT, timeline: buildMinimalTimeline() }, deps),
    ).rejects.toMatchObject({ code: 'INTERNAL_ERROR', stage: 'mux' });

    expect(callLog.ports()).toEqual([
      'ensureDirectory',
      'ensureDirectory',
      'renderMutedVideo',
      'mixTimelineAudio',
      'muxAudioIntoVideo',
    ]);

    for (const port of callLog.ports()) {
      expect(KNOWN_PORTS).toContain(port);
    }
  });

  it('resolves with the measured delta when withinTolerance is false', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog, {
      verifyMixLoudness: async () => ({
        measured: { integratedLufs: -20, truePeakDbtp: -3, loudnessRange: 7, thresholdLufs: -24, targetOffsetDb: 0 },
        withinTolerance: false,
        integratedDeltaLu: -6,
        truePeakDeltaDb: -2,
      }),
    });

    const report = await runRenderPipeline(
      { renderId: RENDER_ID, projectRoot: PROJECT_ROOT, timeline: buildMinimalTimeline() },
      deps,
    );

    expect(report.loudness).toEqual({
      withinTolerance: false,
      integratedLufs: -20,
      truePeakDbtp: -3,
      integratedDeltaLu: -6,
      truePeakDeltaDb: -2,
    });
  });

  it('does not invoke the render port a second time when withinTolerance is false', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog, {
      verifyMixLoudness: async () => ({
        measured: { integratedLufs: -20, truePeakDbtp: -3, loudnessRange: 7, thresholdLufs: -24, targetOffsetDb: 0 },
        withinTolerance: false,
        integratedDeltaLu: -6,
        truePeakDeltaDb: -2,
      }),
    });

    await runRenderPipeline({ renderId: RENDER_ID, projectRoot: PROJECT_ROOT, timeline: buildMinimalTimeline() }, deps);

    expect(callLog.ports().filter((port) => port === 'renderMutedVideo')).toHaveLength(1);
  });
});
