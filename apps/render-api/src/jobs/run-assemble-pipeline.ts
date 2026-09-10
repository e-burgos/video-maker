import {
  buildAssembledTimeline,
  collectAssembleInputs,
  persistAssembledTimeline,
} from '@video-maker/auto-montage';
import type { AssembleDependencies, MediaProject } from '@video-maker/auto-montage';

import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { translateAssembleError } from '../errors/translate-assemble-error';
import { assembleCheckpoint } from './assemble-pipeline-observer';
import type { AssemblePipelineObserver } from './assemble-pipeline-observer';
import type { AssembleJobReport, AssembleStage } from './render-job';

export interface AssemblePipelineRequest {
  readonly project: MediaProject;
  readonly musicAssetId: string | null;
  readonly scenePaddingMs: number | null;
}

async function runAssembleStage<T>(stage: AssembleStage, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (cause) {
    throw translateAssembleError(cause, stage, null);
  }
}

export async function runAssemblePipeline(
  request: AssemblePipelineRequest,
  deps: RenderApiDependencies,
  observer: AssemblePipelineObserver,
): Promise<AssembleJobReport> {
  const assembleDeps: AssembleDependencies = {
    readTextFile: deps.storage.readTextFile,
    writeTextFile: deps.storage.writeTextFile,
    ensureDirectory: deps.ensureDirectory,
  };
  const options = {
    ...(request.musicAssetId === null ? {} : { musicAssetId: request.musicAssetId }),
    ...(request.scenePaddingMs === null ? {} : { scenePaddingMs: request.scenePaddingMs }),
  };

  assembleCheckpoint(observer, 'collect');
  observer.stageStarted('collect');

  const inputs = await runAssembleStage('collect', () => collectAssembleInputs(request.project, assembleDeps));

  assembleCheckpoint(observer, 'build');
  observer.stageStarted('build');

  const built = await runAssembleStage('build', async () => buildAssembledTimeline(inputs, options));

  assembleCheckpoint(observer, 'persist');
  observer.stageStarted('persist');

  const timelinePath = await runAssembleStage('persist', () =>
    persistAssembledTimeline(request.project, assembleDeps, built.timeline),
  );

  return {
    timelinePath,
    editDecisionListPath: null,
    storyboardId: built.storyboardId,
    outputPreset: built.format.preset,
    durationFrames: built.timeline.durationFrames,
    sceneCount: built.sceneCount,
    scenesWithVoice: built.scenesWithVoice,
    scenesWithoutVoice: built.scenesWithoutVoice,
    scenesWithoutVisual: built.scenesWithoutVisual,
  };
}
