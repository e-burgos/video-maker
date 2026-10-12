import type { ReferenceStage } from './render-job';

export interface ReferencePipelineObserver {
  readonly stageStarted: (stage: ReferenceStage) => void;
  readonly cancellationRequested: () => boolean;
}

export class ReferencePipelineCanceledError extends Error {
  readonly stage: ReferenceStage;

  constructor(stage: ReferenceStage) {
    super(`Reference pipeline canceled before the ${stage} stage.`);
    this.name = 'ReferencePipelineCanceledError';
    this.stage = stage;
  }
}

export function isReferencePipelineCanceled(value: unknown): value is ReferencePipelineCanceledError {
  return value instanceof ReferencePipelineCanceledError;
}

export function referenceCheckpoint(observer: ReferencePipelineObserver | undefined, stage: ReferenceStage): void {
  if (observer?.cancellationRequested() === true) {
    throw new ReferencePipelineCanceledError(stage);
  }
}
