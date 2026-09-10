import { resolveMediaProject, serializeMontageDocument } from '@video-maker/auto-montage';
import type { MediaAsset, SceneAssignment } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeObjectStorage } from '../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import { buildStoryboardDocument } from '../__fixtures__/storyboard-fixtures';
import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import type { AssemblePipelineObserver } from './assemble-pipeline-observer';
import { isAssemblePipelineCanceled } from './assemble-pipeline-observer';
import { runAssemblePipeline } from './run-assemble-pipeline';
import type { AssembleStage } from './render-job';

const PROJECT_ROOT = '/var/data/media/acme-launch';
const project = resolveMediaProject(PROJECT_ROOT);
const DOCUMENT = buildStoryboardDocument();

function absolute(relativePath: string): string {
  return `${PROJECT_ROOT}/${relativePath}`;
}

function videoAsset(id: string): MediaAsset {
  return {
    id,
    kind: 'video',
    path: id,
    durationMs: 6000,
    fps: 30,
    width: 1080,
    height: 1920,
    hasAudio: false,
    videoCodec: 'h264',
    probedAt: '2026-09-10T00:00:00.000Z',
  };
}

function imageAsset(id: string): MediaAsset {
  return { id, kind: 'image', path: id, durationMs: 0, width: 1080, height: 1920, probedAt: '2026-09-10T00:00:00.000Z' };
}

function audioAsset(id: string): MediaAsset {
  return {
    id,
    kind: 'audio',
    path: id,
    durationMs: 120_000,
    hasAudio: true,
    audio: { sampleRate: 44_100, channels: 2, codec: 'mp3' },
    probedAt: '2026-09-10T00:00:00.000Z',
  };
}

const catalog = {
  schemaVersion: 1,
  projectSlug: 'acme-launch',
  assets: [
    { role: 'audio', fingerprint: { sizeBytes: 1, modifiedAtMs: 1 }, asset: audioAsset('raw/audio/music01.mp3') },
    { role: 'broll', fingerprint: { sizeBytes: 1, modifiedAtMs: 1 }, asset: videoAsset('raw/broll/desk.mp4') },
    { role: 'image', fingerprint: { sizeBytes: 1, modifiedAtMs: 1 }, asset: imageAsset('raw/images/01.png') },
  ],
  transcripts: [],
  ignored: [],
  probeFailures: [],
};

const assignment: SceneAssignment = {
  schemaVersion: 1,
  storyboardId: DOCUMENT.id,
  assignments: [{ sceneId: 'scene-01', assetId: 'raw/images/01.png' }],
};

function createDeps(options?: { readonly withCatalog?: boolean; readonly withAssignment?: boolean }): {
  deps: RenderApiDependencies;
  storage: ReturnType<typeof createFakeObjectStorage>;
} {
  const callLog = createCallLog();
  const files = [
    { path: absolute('work/storyboard.json'), contents: serializeMontageDocument(DOCUMENT) },
    ...(options?.withCatalog === false
      ? []
      : [{ path: absolute('work/catalog.json'), contents: JSON.stringify(catalog) }]),
    ...(options?.withAssignment === false
      ? []
      : [{ path: absolute('work/scenes.json'), contents: serializeMontageDocument(assignment) }]),
  ];

  const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT], files });
  return { deps: createFakeRenderApiDependencies(callLog, { storage }), storage };
}

function recordingObserver(): { observer: AssemblePipelineObserver; stages: AssembleStage[] } {
  const stages: AssembleStage[] = [];
  const observer: AssemblePipelineObserver = {
    stageStarted: (stage) => {
      stages.push(stage);
    },
    cancellationRequested: () => false,
  };
  return { observer, stages };
}

describe('runAssemblePipeline (US-10-005, US-10-006)', () => {
  it('walks collect, build and persist in order and writes work/timeline.json', async () => {
    const { deps, storage } = createDeps();
    const { observer, stages } = recordingObserver();

    const report = await runAssemblePipeline(
      { project, musicAssetId: null, scenePaddingMs: null },
      deps,
      observer,
    );

    expect(stages).toEqual(['collect', 'build', 'persist']);
    expect(report.timelinePath).toBe('work/timeline.json');
    expect(await storage.readTextFile(absolute('work/timeline.json'))).toContain('"scenes"');
  });

  it('reports how the storyboard was resolved, including what is still missing', async () => {
    const { deps } = createDeps({ withAssignment: false });
    const { observer } = recordingObserver();

    const report = await runAssemblePipeline(
      { project, musicAssetId: null, scenePaddingMs: null },
      deps,
      observer,
    );

    expect(report.sceneCount).toBe(3);
    expect(report.scenesWithVoice).toBe(0);
    expect(report.scenesWithoutVoice).toEqual(['scene-01', 'scene-02', 'scene-03']);
    expect(report.scenesWithoutVisual).toEqual(['scene-01']);
    expect(report.outputPreset).toBe('reels-9x16');
    expect(report.durationFrames).toBeGreaterThan(0);
  });

  it('declares that the assemble path writes no edl, unlike the montage path', async () => {
    const { deps } = createDeps();
    const { observer } = recordingObserver();

    const report = await runAssemblePipeline({ project, musicAssetId: null, scenePaddingMs: null }, deps, observer);

    expect(report.editDecisionListPath).toBeNull();
  });

  it('no aplica el padding a una escena sin voz: su duración sale de la estimada del storyboard', async () => {
    const withDefault = await runAssemblePipeline(
      { project, musicAssetId: null, scenePaddingMs: null },
      createDeps().deps,
      recordingObserver().observer,
    );
    const withoutPadding = await runAssemblePipeline(
      { project, musicAssetId: null, scenePaddingMs: 0 },
      createDeps().deps,
      recordingObserver().observer,
    );

    const estimatedFrames = DOCUMENT.scenes.reduce(
      (total, scene) => total + Math.round((scene.estimatedDurationMs / 1000) * 30),
      0,
    );

    expect(withDefault.durationFrames).toBe(estimatedFrames);
    expect(withoutPadding.durationFrames).toBe(estimatedFrames);
  });

  it('agrega la música del catálogo cuando el job la pide', async () => {
    const withMusic = await runAssemblePipeline(
      { project, musicAssetId: 'raw/audio/music01.mp3', scenePaddingMs: null },
      createDeps().deps,
      recordingObserver().observer,
    );

    expect(withMusic.durationFrames).toBeGreaterThan(0);
  });

  it('translates a missing catalog into a typed API error instead of a raw engine failure', async () => {
    const { deps } = createDeps({ withCatalog: false });
    const { observer } = recordingObserver();

    await expect(
      runAssemblePipeline({ project, musicAssetId: null, scenePaddingMs: null }, deps, observer),
    ).rejects.toMatchObject({ code: 'MONTAGE_RAW_MISSING', stage: 'collect' });
  });

  it('stops before touching the filesystem when the job was canceled', async () => {
    const { deps, storage } = createDeps();
    const observer: AssemblePipelineObserver = {
      stageStarted: () => undefined,
      cancellationRequested: () => true,
    };

    await runAssemblePipeline({ project, musicAssetId: null, scenePaddingMs: null }, deps, observer).then(
      () => expect.unreachable('debía cancelar'),
      (cause: unknown) => {
        expect(isAssemblePipelineCanceled(cause)).toBe(true);
      },
    );

    expect(await storage.stat(absolute('work/timeline.json'))).toBeNull();
  });
});
