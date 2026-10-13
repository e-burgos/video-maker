import { toAbsolutePath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';

import { collectFootageFacts } from './collect-footage-facts';
import { collectMotionFacts } from './collect-motion-facts';
import { readDeliveryPromise } from './delivery-promise';
import { resolveDelivery } from './infer-delivery';
import { measureLevelPlans } from './level-plan';
import type { ReviewFacts, ReviewStoragePort } from './review-facts';
import type { ReviewInputs, ReviewMode } from './review-inputs';
import type { ReviewMeasurements } from './review-measurements';
import { extractSceneFrames } from './scene-frames';
import {
  BLACK_DETECT_MIN_SEC,
  FROZEN_DETECT_MIN_SEC,
  SILENCE_DETECT_MIN_SEC,
  SILENCE_DETECT_NOISE_DB,
} from './review-thresholds';

export interface ReviewRequest {
  readonly project: MediaProject;
  readonly file: string;
  readonly mode: ReviewMode;
}

export interface ReviewInputPorts {
  readonly storage: ReviewStoragePort;
  readonly measurements: ReviewMeasurements;
  readonly nowIso: () => string;
}

async function collectFacts(request: ReviewRequest, storage: ReviewStoragePort): Promise<ReviewFacts> {
  const facts =
    request.mode === 'motion'
      ? await collectMotionFacts(request.project, storage)
      : await collectFootageFacts(request.project, storage);
  return { ...facts, promise: await readDeliveryPromise(request.project, storage) };
}

export function collectReviewFacts(request: ReviewRequest, storage: ReviewStoragePort): Promise<ReviewFacts> {
  return collectFacts(request, storage);
}

export async function collectReviewInputs(request: ReviewRequest, ports: ReviewInputPorts): Promise<ReviewInputs> {
  return measureReviewInputs(request, await collectFacts(request, ports.storage), ports);
}

export async function measureReviewInputs(
  request: ReviewRequest,
  facts: ReviewFacts,
  ports: ReviewInputPorts,
): Promise<ReviewInputs> {
  const { measurements } = ports;
  const renderPath = toAbsolutePath(request.project, request.file);
  const actualDurationSec = await measurements.probeDurationSec(renderPath);

  return {
    file: request.file,
    mode: request.mode,
    createdAt: ports.nowIso(),
    delivery: resolveDelivery({
      mode: request.mode,
      explicit: facts.explicitDelivery,
      dimensions: facts.dimensions,
      durationSec: actualDurationSec,
    }),
    fps: facts.fps,
    expectedDurationSec: facts.expectedDurationSec,
    actualDurationSec,
    master: await measurements.measureMaster(renderPath),
    bumpers: facts.bumpers,
    voiceSegments: await measureLevelPlans(facts.levelPlans, measurements, facts.bumperOffsetSec),
    hasVoice: facts.hasVoice,
    captionStyle: facts.captionStyle,
    captions: facts.captions,
    frame: facts.frame,
    captionLayout: facts.captionLayout ?? null,
    blackSegments: await measurements.detectBlack(renderPath, BLACK_DETECT_MIN_SEC),
    frozenSegments: await measurements.detectFrozen(renderPath, FROZEN_DETECT_MIN_SEC, actualDurationSec),
    silences: await measurements.detectSilences(
      renderPath,
      SILENCE_DETECT_MIN_SEC,
      SILENCE_DETECT_NOISE_DB,
      actualDurationSec,
    ),
    missingAssets: facts.missingAssets,
    sceneFrames: await extractSceneFrames(
      { project: request.project, file: request.file, scenes: facts.scenes, durationSec: actualDurationSec },
      ports.storage,
      measurements,
    ),
    promise: facts.promise,
  };
}
