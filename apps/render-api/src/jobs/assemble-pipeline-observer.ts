import type { AssembleStage } from './render-job';

export interface AssemblePipelineObserver {
  readonly stageStarted: (stage: AssembleStage) => void;
  readonly cancellationRequested: () => boolean;
}

export class AssemblePipelineCanceledError extends Error {
  readonly stage: AssembleStage;

  constructor(stage: AssembleStage) {
    super(`Assemble pipeline canceled before the ${stage} stage.`);
    this.name = 'AssemblePipelineCanceledError';
    this.stage = stage;
  }
}

export function isAssemblePipelineCanceled(value: unknown): value is AssemblePipelineCanceledError {
  return value instanceof AssemblePipelineCanceledError;
}

export function assembleCheckpoint(
  observer: AssemblePipelineObserver | undefined,
  stage: AssembleStage,
): void {
  if (observer?.cancellationRequested() === true) {
    throw new AssemblePipelineCanceledError(stage);
  }
}
