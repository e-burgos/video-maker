import { toAbsolutePath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';
import type { Transcription } from '@video-maker/timeline-core';
import { ZodError } from 'zod';

import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import { isRenderApiError } from '../errors/render-api-error';
import { translateEngineError } from '../errors/translate-engine-error';
import { buildReferenceBrief } from '../reference/build-reference-brief';
import type { ReferenceMeasurements, ReferenceProbe, ReferenceSilence } from '../reference/reference-measurements';
import { createFfmpegReferenceMeasurements } from '../reference/reference-measurements';
import {
  REFERENCE_WORK_DIRECTORY,
  referenceAudioPath,
  referenceKeyframePath,
  referenceKeyframesDirectory,
  referenceNameFor,
  referenceWhisperOutBase,
} from '../reference/reference-paths';
import { writeReferenceBrief } from '../reference/reference-store';
import { isReferencePipelineCanceled, referenceCheckpoint } from './reference-pipeline-observer';
import type { ReferencePipelineObserver } from './reference-pipeline-observer';
import type { ReferenceJobReport, ReferenceStage } from './render-job';

const TRANSCRIPTION_SAMPLE_RATE = 16000;
const TRANSCRIPTION_CHANNELS = 1;
const AUTO_DETECT_LANGUAGE = 'auto';

export interface ReferencePipelineRequest {
  readonly project: MediaProject;
  readonly file: string;
}

export interface ReferencePipelineOptions {
  readonly measurements?: ReferenceMeasurements;
}

function toStageError(cause: unknown, stage: ReferenceStage, resource: string): PipelineStageError {
  if (cause instanceof ZodError) {
    return new PipelineStageError({
      code: 'REFERENCE_FILE_INVALID',
      stage,
      resource,
      hint: 'the analysis does not produce a valid reference brief',
      cause,
    });
  }
  const translated = isRenderApiError(cause) ? cause : translateEngineError(cause, null, resource);
  return new PipelineStageError({
    code: translated.code,
    stage,
    resource: translated.resource,
    expected: translated.expected,
    hint: translated.hint,
    details: translated.details,
    cause,
  });
}

async function runReferenceStage<T>(stage: ReferenceStage, resource: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (cause) {
    if (isReferencePipelineCanceled(cause)) {
      throw cause;
    }
    throw toStageError(cause, stage, resource);
  }
}

async function resolveMeasurements(
  deps: RenderApiDependencies,
  options: ReferencePipelineOptions,
): Promise<ReferenceMeasurements> {
  if (options.measurements !== undefined) {
    return options.measurements;
  }
  const [binaries, runner] = await Promise.all([deps.resolveMontageBinaries(), deps.createCommandRunner()]);
  return createFfmpegReferenceMeasurements(runner, { ffmpegPath: binaries.ffmpeg, ffprobePath: binaries.ffprobe });
}

function assertVideoWasProbed(probe: ReferenceProbe, file: string): void {
  if (probe.width === 0 || probe.height === 0 || probe.durationSec <= 0) {
    throw new PipelineStageError({
      code: 'REFERENCE_FILE_INVALID',
      stage: 'probe',
      resource: file,
      hint: 'the file has no readable video stream',
    });
  }
}

async function transcribeReference(
  deps: RenderApiDependencies,
  project: MediaProject,
  file: string,
  name: string,
): Promise<Transcription> {
  const wavPath = toAbsolutePath(project, referenceAudioPath(name));
  await deps.extractVoiceAudio({
    inputPath: toAbsolutePath(project, file),
    outPath: wavPath,
    sampleRate: TRANSCRIPTION_SAMPLE_RATE,
    channels: TRANSCRIPTION_CHANNELS,
    projectRoot: project.root,
  });
  return deps.transcribeVoice({
    wavPath,
    outBase: toAbsolutePath(project, referenceWhisperOutBase(name)),
    assetId: file,
    language: AUTO_DETECT_LANGUAGE,
    projectRoot: project.root,
  });
}

interface AudioAnalysis {
  readonly transcription: Transcription | null;
  readonly integratedLufs: number | null;
  readonly longSilences: readonly ReferenceSilence[];
}

async function analyzeAudio(
  deps: RenderApiDependencies,
  measurements: ReferenceMeasurements,
  request: ReferencePipelineRequest,
  name: string,
  probe: ReferenceProbe,
): Promise<AudioAnalysis> {
  if (!probe.hasAudio) {
    return { transcription: null, integratedLufs: null, longSilences: [] };
  }
  const absoluteFile = toAbsolutePath(request.project, request.file);
  await deps.storage.ensureDirectory(toAbsolutePath(request.project, REFERENCE_WORK_DIRECTORY));
  const transcription = await transcribeReference(deps, request.project, request.file, name);
  const integratedLufs = await measurements.measureLoudness(absoluteFile);
  const longSilences = await measurements.detectLongSilences(absoluteFile, probe.durationSec);
  return { transcription, integratedLufs, longSilences };
}

export async function runReferencePipeline(
  request: ReferencePipelineRequest,
  deps: RenderApiDependencies,
  observer: ReferencePipelineObserver,
  options: ReferencePipelineOptions = {},
): Promise<ReferenceJobReport> {
  const { file, project } = request;
  const name = referenceNameFor(file);
  const absoluteFile = toAbsolutePath(project, file);

  referenceCheckpoint(observer, 'probe');
  observer.stageStarted('probe');
  const measurements = await runReferenceStage('probe', file, () => resolveMeasurements(deps, options));
  const probe = await runReferenceStage('probe', file, async () => {
    const probed = await measurements.probe(absoluteFile);
    assertVideoWasProbed(probed, file);
    return probed;
  });

  referenceCheckpoint(observer, 'scenes');
  observer.stageStarted('scenes');
  const scenes = await runReferenceStage('scenes', file, () => measurements.detectScenes(absoluteFile, probe.durationSec));

  referenceCheckpoint(observer, 'transcribe');
  observer.stageStarted('transcribe');
  const audio = await runReferenceStage('transcribe', file, () => analyzeAudio(deps, measurements, request, name, probe));

  referenceCheckpoint(observer, 'keyframes');
  observer.stageStarted('keyframes');
  await runReferenceStage('keyframes', file, async () => {
    await deps.storage.ensureDirectory(toAbsolutePath(project, referenceKeyframesDirectory(name)));
    await measurements.extractKeyframes(absoluteFile, scenes, (scene) =>
      toAbsolutePath(project, referenceKeyframePath(name, scene.index)),
    );
  });

  referenceCheckpoint(observer, 'persist');
  observer.stageStarted('persist');
  const brief = buildReferenceBrief({
    file,
    name,
    probe,
    scenes,
    transcription: audio.transcription,
    integratedLufs: audio.integratedLufs,
    longSilences: audio.longSilences,
    createdAt: deps.clock.nowIso(),
  });
  const briefFile = await runReferenceStage('persist', file, () => writeReferenceBrief(deps.storage, project, name, brief));

  return {
    file,
    name,
    briefFile,
    durationSec: brief.durationSec,
    scenes: brief.scenes.length,
    cutsPerMinute: brief.pace.cutsPerMinute,
    hasVoice: brief.voice !== null,
  };
}
