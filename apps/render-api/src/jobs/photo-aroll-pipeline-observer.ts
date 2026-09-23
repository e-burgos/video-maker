import type { PhotoArollStage } from './render-job';

export interface PhotoArollPipelineObserver {
  readonly stageStarted: (stage: PhotoArollStage) => void;
  readonly clipProcessed: (totalClips: number) => void;
  readonly cancellationRequested: () => boolean;
}

export class PhotoArollPipelineCanceledError extends Error {
  readonly stage: PhotoArollStage;

  constructor(stage: PhotoArollStage) {
    super(`Photo A-roll pipeline canceled before the ${stage} stage.`);
    this.name = 'PhotoArollPipelineCanceledError';
    this.stage = stage;
  }
}

export function isPhotoArollPipelineCanceled(value: unknown): value is PhotoArollPipelineCanceledError {
  return value instanceof PhotoArollPipelineCanceledError;
}

export function checkpoint(observer: PhotoArollPipelineObserver | undefined, stage: PhotoArollStage): void {
  if (observer?.cancellationRequested() === true) {
    throw new PhotoArollPipelineCanceledError(stage);
  }
}
