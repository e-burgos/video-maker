import type { ReviewStage } from './render-job';

export interface ReviewPipelineObserver {
  readonly stageStarted: (stage: ReviewStage) => void;
  readonly cancellationRequested: () => boolean;
}

export class ReviewPipelineCanceledError extends Error {
  readonly stage: ReviewStage;

  constructor(stage: ReviewStage) {
    super(`Review pipeline canceled before the ${stage} stage.`);
    this.name = 'ReviewPipelineCanceledError';
    this.stage = stage;
  }
}

export function isReviewPipelineCanceled(value: unknown): value is ReviewPipelineCanceledError {
  return value instanceof ReviewPipelineCanceledError;
}

export function reviewCheckpoint(observer: ReviewPipelineObserver | undefined, stage: ReviewStage): void {
  if (observer?.cancellationRequested() === true) {
    throw new ReviewPipelineCanceledError(stage);
  }
}
