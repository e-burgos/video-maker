import type { Timeline } from '@video-maker/timeline-core';

import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { translateEngineError } from '../errors/translate-engine-error';
import type { RenderPipelineStage } from '../errors/render-api-error';
import { RenderPipelineCanceledError } from './render-pipeline-observer';
import type { RenderPipelineObserver } from './render-pipeline-observer';
import { resolveRenderPipelinePaths } from './render-pipeline-paths';

export interface RenderPipelineRequest {
  readonly renderId: string;
  readonly projectRoot: string;
  readonly timeline: Timeline;
  readonly sampleSeconds?: number;
}

export interface RenderDeliverableReport {
  readonly resource: string;
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly durationInFrames: number;
}

export interface RenderIntermediatesReport {
  readonly mutedVideoResource: string;
  readonly masterAudioResource: string;
}

export interface RenderLoudnessReport {
  readonly withinTolerance: boolean;
  readonly integratedLufs: number;
  readonly truePeakDbtp: number;
  readonly integratedDeltaLu: number;
  readonly truePeakDeltaDb: number;
}

export interface RenderPipelineReport {
  readonly renderId: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly deliverable: RenderDeliverableReport;
  readonly intermediates: RenderIntermediatesReport;
  readonly loudness: RenderLoudnessReport;
  readonly sample?: true;
}

async function runStage<T>(
  stage: RenderPipelineStage,
  resource: string,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (cause) {
    throw stage === 'prepare'
      ? translateEngineError(cause, stage, resource, 'WORKDIR_UNWRITABLE')
      : translateEngineError(cause, stage, resource);
  }
}

function checkpoint(observer: RenderPipelineObserver | undefined, stage: RenderPipelineStage): void {
  if (observer?.cancellationRequested() === true) {
    throw new RenderPipelineCanceledError(stage);
  }
}

export async function runRenderPipeline(
  request: RenderPipelineRequest,
  deps: RenderApiDependencies,
  observer?: RenderPipelineObserver,
): Promise<RenderPipelineReport> {
  const paths = resolveRenderPipelinePaths(request.projectRoot, request.renderId, request.sampleSeconds !== undefined);
  const startedAt = deps.clock.nowIso();

  observer?.stageStarted('prepare');
  await runStage('prepare', paths.workDir.resource, async () => {
    await deps.ensureDirectory(paths.workDir.path);
    await deps.ensureDirectory(paths.outDir.path);
  });

  checkpoint(observer, 'render');
  observer?.stageStarted('render');
  const rendered = await runStage('render', paths.mutedVideo.resource, () =>
    deps.renderMutedVideo({
      timeline: request.timeline,
      outPath: paths.mutedVideo.path,
      publicDir: paths.publicDir,
      ...(request.sampleSeconds === undefined ? {} : { sampleSeconds: request.sampleSeconds }),
      ...(observer === undefined ? {} : { onProgress: observer.renderProgressed }),
    }),
  );

  checkpoint(observer, 'mix');
  observer?.stageStarted('mix');
  await runStage('mix', paths.masterAudio.resource, () =>
    deps.mixTimelineAudio({
      timeline: request.timeline,
      outPath: paths.masterAudio.path,
      projectRoot: paths.publicDir,
    }),
  );

  checkpoint(observer, 'mux');
  observer?.stageStarted('mux');
  await runStage('mux', paths.deliverable.resource, () =>
    deps.muxAudioIntoVideo({
      videoPath: rendered.outPath,
      audioPath: paths.masterAudio.path,
      outPath: paths.deliverable.path,
    }),
  );

  checkpoint(observer, 'verify');
  observer?.stageStarted('verify');
  const verified = await runStage('verify', paths.deliverable.resource, () =>
    deps.verifyMixLoudness({ path: paths.deliverable.path, target: request.timeline.audioMix.voice }),
  );

  return {
    renderId: request.renderId,
    startedAt,
    finishedAt: deps.clock.nowIso(),
    deliverable: {
      resource: paths.deliverable.resource,
      width: rendered.width,
      height: rendered.height,
      fps: rendered.fps,
      durationInFrames: rendered.durationInFrames,
    },
    intermediates: {
      mutedVideoResource: paths.mutedVideo.resource,
      masterAudioResource: paths.masterAudio.resource,
    },
    loudness: {
      withinTolerance: verified.withinTolerance,
      integratedLufs: verified.measured.integratedLufs,
      truePeakDbtp: verified.measured.truePeakDbtp,
      integratedDeltaLu: verified.integratedDeltaLu,
      truePeakDeltaDb: verified.truePeakDeltaDb,
    },
    ...(request.sampleSeconds === undefined ? {} : { sample: true as const }),
  };
}
