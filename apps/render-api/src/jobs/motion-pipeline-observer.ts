import type { MotionStage } from './render-job';

export interface MotionPipelineObserver {
  readonly stageStarted: (stage: MotionStage) => void;
  readonly lineVoiced: (linesVoiced: number, totalLines: number) => void;
  readonly cancellationRequested: () => boolean;
}

export class MotionPipelineCanceledError extends Error {
  readonly stage: MotionStage;

  constructor(stage: MotionStage) {
    super(`Motion pipeline canceled before the ${stage} stage.`);
    this.name = 'MotionPipelineCanceledError';
    this.stage = stage;
  }
}

export function isMotionPipelineCanceled(value: unknown): value is MotionPipelineCanceledError {
  return value instanceof MotionPipelineCanceledError;
}

export function motionCheckpoint(observer: MotionPipelineObserver | undefined, stage: MotionStage): void {
  if (observer?.cancellationRequested() === true) {
    throw new MotionPipelineCanceledError(stage);
  }
}
