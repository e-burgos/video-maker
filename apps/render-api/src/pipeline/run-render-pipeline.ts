import type { Timeline } from '@video-maker/timeline-core';

import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { translateEngineError } from '../errors/translate-engine-error';
import type { RenderPipelineStage } from '../errors/render-api-error';
import { resolveRenderPipelinePaths } from './render-pipeline-paths';

export interface RenderPipelineRequest {
  readonly renderId: string;
  readonly projectRoot: string;
  readonly timeline: Timeline;
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

export async function runRenderPipeline(
  request: RenderPipelineRequest,
  deps: RenderApiDependencies,
): Promise<RenderPipelineReport> {
  const paths = resolveRenderPipelinePaths(request.projectRoot, request.renderId);
  const startedAt = deps.clock.nowIso();

  await runStage('prepare', paths.workDir.resource, async () => {
    await deps.ensureDirectory(paths.workDir.path);
    await deps.ensureDirectory(paths.outDir.path);
  });

  const rendered = await runStage('render', paths.mutedVideo.resource, () =>
    deps.renderMutedVideo({
      timeline: request.timeline,
      outPath: paths.mutedVideo.path,
      publicDir: paths.publicDir,
    }),
  );

  await runStage('mix', paths.masterAudio.resource, () =>
    deps.mixTimelineAudio({ timeline: request.timeline, outPath: paths.masterAudio.path }),
  );

  await runStage('mux', paths.deliverable.resource, () =>
    deps.muxAudioIntoVideo({
      videoPath: rendered.outPath,
      audioPath: paths.masterAudio.path,
      outPath: paths.deliverable.path,
    }),
  );

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
  };
}
