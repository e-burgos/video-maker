import type { MediaProject } from '@video-maker/auto-montage';
import { ZodError } from 'zod';

import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import { isRenderApiError } from '../errors/render-api-error';
import { translateEngineError } from '../errors/translate-engine-error';
import { collectReviewFacts, measureReviewInputs } from '../review/collect-review-inputs';
import type { ReviewInputPorts } from '../review/collect-review-inputs';
import type { ReviewMode } from '../review/review-inputs';
import { ReviewInputsUnavailableError } from '../review/review-errors';
import type { ReviewMeasurements } from '../review/review-measurements';
import { createFfmpegReviewMeasurements } from '../review/review-measurements';
import { reviewRender } from '../review/review-rules';
import { countFindings, writeReview } from '../review/review-store';
import type { ReviewJobReport, ReviewStage } from './render-job';
import { isReviewPipelineCanceled, reviewCheckpoint } from './review-pipeline-observer';
import type { ReviewPipelineObserver } from './review-pipeline-observer';

export interface ReviewPipelineRequest {
  readonly project: MediaProject;
  readonly file: string;
  readonly mode: ReviewMode;
}

function toStageError(cause: unknown, stage: ReviewStage, resource: string): PipelineStageError {
  if (cause instanceof ReviewInputsUnavailableError) {
    return new PipelineStageError({
      code: 'REVIEW_INPUTS_UNAVAILABLE',
      stage,
      resource: cause.resource,
      hint: cause.message,
      cause,
    });
  }
  if (cause instanceof ZodError) {
    return new PipelineStageError({
      code: 'REVIEW_INPUTS_UNAVAILABLE',
      stage,
      resource,
      hint: 'a stored timeline or report does not pass validation',
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

async function runReviewStage<T>(stage: ReviewStage, resource: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (cause) {
    if (isReviewPipelineCanceled(cause)) {
      throw cause;
    }
    throw toStageError(cause, stage, resource);
  }
}

export interface ReviewPipelineOptions {
  readonly measurements?: ReviewMeasurements;
}

async function buildPorts(deps: RenderApiDependencies, options: ReviewPipelineOptions): Promise<ReviewInputPorts> {
  if (options.measurements !== undefined) {
    return { storage: deps.storage, measurements: options.measurements, nowIso: () => deps.clock.nowIso() };
  }
  const [binaries, runner] = await Promise.all([deps.resolveMontageBinaries(), deps.createCommandRunner()]);
  return {
    storage: deps.storage,
    measurements: createFfmpegReviewMeasurements(runner, {
      ffmpegPath: binaries.ffmpeg,
      ffprobePath: binaries.ffprobe,
    }),
    nowIso: () => deps.clock.nowIso(),
  };
}

export async function runReviewPipeline(
  request: ReviewPipelineRequest,
  deps: RenderApiDependencies,
  observer: ReviewPipelineObserver,
  options: ReviewPipelineOptions = {},
): Promise<ReviewJobReport> {
  const { file } = request;

  reviewCheckpoint(observer, 'collect');
  observer.stageStarted('collect');
  const ports = await runReviewStage('collect', file, () => buildPorts(deps, options));
  const facts = await runReviewStage('collect', file, () => collectReviewFacts(request, deps.storage));

  reviewCheckpoint(observer, 'measure');
  observer.stageStarted('measure');
  const inputs = await runReviewStage('measure', file, () => measureReviewInputs(request, facts, ports));

  reviewCheckpoint(observer, 'rules');
  observer.stageStarted('rules');
  const report = await runReviewStage('rules', file, () => Promise.resolve(reviewRender(inputs)));

  reviewCheckpoint(observer, 'write');
  observer.stageStarted('write');
  const reviewFile = await runReviewStage('write', file, () => writeReview(deps.storage, request.project, report));

  return { file, reviewFile, status: report.status, counts: countFindings(report) };
}
