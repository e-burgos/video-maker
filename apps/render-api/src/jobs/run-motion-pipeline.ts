import { toAbsolutePath, workPath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';
import {
  autoStoryboard,
  briefImageRef,
  composeFromStoryboard,
  composeProject,
  joinPath,
  parseMotionBrief,
  parseMotionStoryboard,
  planProject,
  renderProject,
  storyboardImages,
  voiceProject,
} from '@video-maker/motion-graphics';
import type { MotionPipelinePorts, MotionStoryboard } from '@video-maker/motion-graphics';

import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import { isRenderApiError } from '../errors/render-api-error';
import { translateMotionError } from '../errors/translate-motion-error';
import { motionCheckpoint } from './motion-pipeline-observer';
import type { MotionPipelineObserver } from './motion-pipeline-observer';
import type { MotionJobReport, MotionJobStoryboardReport, MotionPhase, MotionStage } from './render-job';

export interface MotionPipelineRequest {
  readonly project: MediaProject;
  readonly phase: MotionPhase;
  readonly output: string;
  readonly takes: number;
}

const MOTION_WORK_DIRECTORY = workPath('motion');
const BRIEF_PATH = 'motion/brief.json';
const STORYBOARD_PATH = 'motion/storyboard.json';
const RAW_IMAGES_DIRECTORY = 'raw/images';
const OUT_DIRECTORY = 'out';
const RENDER_FPS = 30;
const RENDER_QUALITY = 'delivery';

function withStage(error: PipelineStageError, stage: MotionStage): PipelineStageError {
  return new PipelineStageError({
    code: error.code,
    stage,
    resource: error.resource,
    expected: error.expected,
    hint: error.hint,
    details: error.details,
    cause: error.cause,
  });
}

async function runMotionStage<T>(stage: MotionStage, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (cause) {
    const translated = translateMotionError(cause, stage, null);
    if (translated !== null) {
      throw translated;
    }
    if (cause instanceof PipelineStageError) {
      throw cause.stage === null ? withStage(cause, stage) : cause;
    }
    if (isRenderApiError(cause)) {
      throw cause;
    }
    throw new PipelineStageError({ code: 'INTERNAL_ERROR', stage, cause });
  }
}

async function copyImagesIntoWorkDirectory(
  ports: MotionPipelinePorts,
  project: MediaProject,
  workDirectory: string,
  imageRefs: readonly string[],
): Promise<void> {
  for (const ref of imageRefs) {
    const file = ref.slice('images/'.length);
    await ports.copyFile(
      toAbsolutePath(project, `${RAW_IMAGES_DIRECTORY}/${file}`),
      joinPath(workDirectory, `images/${file}`),
    );
  }
}

function localImageRefs(refs: readonly string[]): readonly string[] {
  return refs.filter((ref) => ref.startsWith('images/'));
}

async function readJson(ports: MotionPipelinePorts, path: string): Promise<unknown> {
  return JSON.parse(await ports.readText(path)) as unknown;
}

async function buildStoryboard(
  ports: MotionPipelinePorts,
  project: MediaProject,
  workDirectory: string,
): Promise<{ readonly storyboard: MotionStoryboard; readonly report: MotionJobStoryboardReport }> {
  const brief = parseMotionBrief(await readJson(ports, toAbsolutePath(project, BRIEF_PATH)));
  await copyImagesIntoWorkDirectory(
    ports,
    project,
    workDirectory,
    brief.images.map((image) => briefImageRef(image.file)),
  );

  const result = await autoStoryboard(ports, brief, workDirectory, workDirectory);
  const storyboard = parseMotionStoryboard(await readJson(ports, joinPath(workDirectory, 'storyboard.json')));
  await ports.writeText(toAbsolutePath(project, STORYBOARD_PATH), `${JSON.stringify(storyboard, null, 2)}\n`);

  return {
    storyboard,
    report: {
      repaired: result.repaired,
      tokensIn: result.usage.inputTokens,
      tokensOut: result.usage.outputTokens,
      costUsd: result.usage.costUsd ?? null,
    },
  };
}

interface VideoResult {
  readonly path: string;
  readonly durationSec: number;
  readonly scenes: number;
}

async function renderVideo(
  ports: MotionPipelinePorts,
  request: MotionPipelineRequest,
  workDirectory: string,
  observer: MotionPipelineObserver,
): Promise<VideoResult> {
  const { project } = request;

  motionCheckpoint(observer, 'storyboard');
  observer.stageStarted('storyboard');
  const storyboard = await runMotionStage('storyboard', async () => {
    const stored = parseMotionStoryboard(await readJson(ports, toAbsolutePath(project, STORYBOARD_PATH)));
    await copyImagesIntoWorkDirectory(ports, project, workDirectory, localImageRefs(storyboardImages(stored)));
    await composeFromStoryboard(ports, stored, workDirectory, workDirectory);
    return stored;
  });

  motionCheckpoint(observer, 'voice');
  observer.stageStarted('voice');
  await runMotionStage('voice', () =>
    voiceProject(ports, workDirectory, {
      takes: request.takes,
      onLine: (line) => observer.lineVoiced(line.done, line.total),
    }),
  );

  motionCheckpoint(observer, 'plan');
  observer.stageStarted('plan');
  await runMotionStage('plan', () => planProject(ports, workDirectory, { beatSync: storyboard.beatSync }));

  motionCheckpoint(observer, 'compose');
  observer.stageStarted('compose');
  const composed = await runMotionStage('compose', () => composeProject(ports, workDirectory));

  motionCheckpoint(observer, 'render');
  observer.stageStarted('render');
  const outputRelativePath = `${OUT_DIRECTORY}/${request.output}`;
  await runMotionStage('render', () =>
    renderProject(ports, workDirectory, {
      outPath: toAbsolutePath(project, outputRelativePath),
      fps: RENDER_FPS,
      quality: RENDER_QUALITY,
    }),
  );

  return { path: outputRelativePath, durationSec: composed.durationSec, scenes: composed.scenes };
}

export async function runMotionPipeline(
  request: MotionPipelineRequest,
  deps: RenderApiDependencies,
  observer: MotionPipelineObserver,
): Promise<MotionJobReport> {
  const ports = deps.motionPorts();
  const workDirectory = toAbsolutePath(request.project, MOTION_WORK_DIRECTORY);

  let storyboardReport: MotionJobStoryboardReport | null = null;
  let storyboardScenes = 0;

  if (request.phase !== 'video') {
    motionCheckpoint(observer, 'storyboard');
    observer.stageStarted('storyboard');
    const built = await runMotionStage('storyboard', () => buildStoryboard(ports, request.project, workDirectory));
    storyboardReport = built.report;
    storyboardScenes = built.storyboard.scenes.length;
  }

  if (request.phase === 'storyboard') {
    return { path: null, durationSec: null, scenes: storyboardScenes, storyboard: storyboardReport };
  }

  const video = await renderVideo(ports, request, workDirectory, observer);
  return { ...video, storyboard: storyboardReport };
}
