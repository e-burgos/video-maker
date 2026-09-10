import { describe, expect, it } from 'vitest';

import { createFakeCliDependencies, createFakeFileSystem } from '../__fixtures__/fake-cli-dependencies';
import { fixtureMediaProject } from '../__fixtures__/media-project';
import { UnresolvedAudioAssetError } from '@video-maker/media-local';
import { StageFailedError } from '../errors/stage-failed-error';
import { StageInputMissingError } from '../errors/stage-input-missing-error';
import type { MuxRequest, RenderRequest } from '../deps/timeline-renderer';

import { renderCommand } from './render-command';

const VALID_TIMELINE = {
  schemaVersion: 1,
  id: 'timeline-1',
  format: { preset: 'reels-9x16', width: 1080, height: 1920, fps: 30 },
  durationFrames: 556,
  assets: [],
  tracks: { aroll: [], broll: [], voice: [], music: [], captions: [] },
  audioMix: { voice: {}, music: {}, automation: [] },
};

const WORK_DIR = `${fixtureMediaProject.root}/work/renders/${fixtureMediaProject.slug}`;
const MUTED_VIDEO = `${WORK_DIR}/video-muted.mp4`;
const MASTER_AUDIO = `${WORK_DIR}/master.wav`;
const DELIVERABLE = `${fixtureMediaProject.outDir}/${fixtureMediaProject.slug}.mp4`;

function fileSystemWithTimeline() {
  return createFakeFileSystem([
    { path: `${fixtureMediaProject.workDir}/timeline.json`, contents: JSON.stringify(VALID_TIMELINE) },
  ]);
}

function renderOutcomeFor(request: RenderRequest) {
  return { outPath: request.outPath, width: 1080, height: 1920, fps: 30, durationInFrames: 556 };
}

describe('renderCommand', () => {
  it('propagates assertTimelineExists when work/timeline.json is missing', async () => {
    const deps = createFakeCliDependencies({ fileSystem: createFakeFileSystem([]) });

    await expect(renderCommand(fixtureMediaProject, deps)).rejects.toBeInstanceOf(StageInputMissingError);
  });

  it('renders MUTED into work/renders/<slug>/, never straight into out/ (US-15-010)', async () => {
    const receivedRequests: RenderRequest[] = [];
    const deps = createFakeCliDependencies({
      fileSystem: fileSystemWithTimeline(),
      renderTimeline: async (_timeline, request) => {
        receivedRequests.push(request);
        return renderOutcomeFor(request);
      },
    });

    await renderCommand(fixtureMediaProject, deps);

    expect(receivedRequests).toEqual([{ publicDir: fixtureMediaProject.root, outPath: MUTED_VIDEO }]);
    expect(receivedRequests[0]?.outPath).not.toBe(DELIVERABLE);
  });

  it('encadena mix → mux → verify con las MISMAS rutas que el job render de la API', async () => {
    const calls: string[] = [];
    const muxRequests: MuxRequest[] = [];
    let mixOutPath = '';
    let mixProjectRoot = '';
    let verifiedPath = '';

    const deps = createFakeCliDependencies({
      fileSystem: fileSystemWithTimeline(),
      renderTimeline: async (_timeline, request) => {
        calls.push('render');
        return renderOutcomeFor(request);
      },
      mixTimelineAudio: async (_timeline, request) => {
        calls.push('mix');
        mixOutPath = request.outPath;
        mixProjectRoot = request.projectRoot;
        return { outputPath: request.outPath };
      },
      muxAudioIntoVideo: async (request) => {
        calls.push('mux');
        muxRequests.push(request);
        return { outputPath: request.outPath };
      },
      verifyMixLoudness: async (_timeline, path) => {
        calls.push('verify');
        verifiedPath = path;
        return {
          withinTolerance: true,
          integratedLufs: -14.2,
          truePeakDbtp: -1.4,
          integratedDeltaLu: 0.2,
          truePeakDeltaDb: 0.1,
        };
      },
    });

    await renderCommand(fixtureMediaProject, deps);

    expect(calls).toEqual(['render', 'mix', 'mux', 'verify']);
    expect(mixOutPath).toBe(MASTER_AUDIO);
    expect(mixProjectRoot).toBe(fixtureMediaProject.root);
    expect(muxRequests).toEqual([
      { videoPath: MUTED_VIDEO, audioPath: MASTER_AUDIO, outPath: DELIVERABLE },
    ]);
    expect(verifiedPath).toBe(DELIVERABLE);
  });

  it('crea el directorio de intermedios y out/ antes de renderizar', async () => {
    const fileSystem = fileSystemWithTimeline();
    const deps = createFakeCliDependencies({
      fileSystem,
      renderTimeline: async (_timeline, request) => renderOutcomeFor(request),
    });

    await renderCommand(fixtureMediaProject, deps);

    expect(fileSystem.directories()).toContain(WORK_DIR);
    expect(fileSystem.directories()).toContain(fixtureMediaProject.outDir);
  });

  it('reporta el entregable, los intermedios y la verificación de loudness', async () => {
    const deps = createFakeCliDependencies({
      fileSystem: fileSystemWithTimeline(),
      renderTimeline: async (_timeline, request) => renderOutcomeFor(request),
      verifyMixLoudness: async () => ({
        withinTolerance: false,
        integratedLufs: -11,
        truePeakDbtp: -0.2,
        integratedDeltaLu: 3,
        truePeakDeltaDb: 1.3,
      }),
    });

    expect(await renderCommand(fixtureMediaProject, deps)).toEqual({
      kind: 'render',
      outPath: `out/${fixtureMediaProject.slug}.mp4`,
      width: 1080,
      height: 1920,
      fps: 30,
      durationInFrames: 556,
      mutedVideoPath: `work/renders/${fixtureMediaProject.slug}/video-muted.mp4`,
      masterAudioPath: `work/renders/${fixtureMediaProject.slug}/master.wav`,
      loudness: {
        withinTolerance: false,
        integratedLufs: -11,
        truePeakDbtp: -0.2,
        integratedDeltaLu: 3,
        truePeakDeltaDb: 1.3,
      },
    });
  });

  it('propagates a StageFailedError thrown by the render port untouched (the adapter already translated it)', async () => {
    const renderFailure = new Error('BUNDLE_FAILED');
    const deps = createFakeCliDependencies({
      fileSystem: fileSystemWithTimeline(),
      renderTimeline: async () => {
        throw renderFailure;
      },
    });

    await expect(renderCommand(fixtureMediaProject, deps)).rejects.toBe(renderFailure);
  });

  it('traduce un error de media-local del mix, del mux o del verify a STAGE_FAILED de la etapa render', async () => {
    const failure = new UnresolvedAudioAssetError({ assetId: 'a', clipId: 'c', track: 'music' });
    const deps = createFakeCliDependencies({
      fileSystem: fileSystemWithTimeline(),
      renderTimeline: async (_timeline, request) => renderOutcomeFor(request),
      mixTimelineAudio: async () => {
        throw failure;
      },
    });

    try {
      await renderCommand(fixtureMediaProject, deps);
      expect.unreachable('debía fallar');
    } catch (error) {
      expect(error).toBeInstanceOf(StageFailedError);
      expect(error).toMatchObject({ stage: 'render', reason: 'UNRESOLVED_AUDIO_ASSET', resource: DELIVERABLE });
    }
  });
});
