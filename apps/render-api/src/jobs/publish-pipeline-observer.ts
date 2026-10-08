import type { PublishStage } from './render-job';

export interface PublishPipelineObserver {
  readonly stageStarted: (stage: PublishStage) => void;
  readonly bytesUploaded: (uploadedBytes: number, totalBytes: number) => void;
  readonly cancellationRequested: () => boolean;
}

export class PublishPipelineCanceledError extends Error {
  readonly stage: PublishStage;

  constructor(stage: PublishStage) {
    super(`Publish pipeline canceled before the ${stage} stage.`);
    this.name = 'PublishPipelineCanceledError';
    this.stage = stage;
  }
}

export function isPublishPipelineCanceled(value: unknown): value is PublishPipelineCanceledError {
  return value instanceof PublishPipelineCanceledError;
}

export function publishCheckpoint(observer: PublishPipelineObserver | undefined, stage: PublishStage): void {
  if (observer?.cancellationRequested() === true) {
    throw new PublishPipelineCanceledError(stage);
  }
}
