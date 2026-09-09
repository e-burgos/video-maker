import type { MontageStage } from './render-job';

export interface MontagePipelineObserver {
  readonly stageStarted: (stage: MontageStage) => void;
  readonly assetProcessed: (stage: 'probe' | 'transcribe', totalAssets: number) => void;
  readonly cancellationRequested: () => boolean;
}

export class MontagePipelineCanceledError extends Error {
  readonly stage: MontageStage;

  constructor(stage: MontageStage) {
    super(`Montage pipeline canceled before the ${stage} stage.`);
    this.name = 'MontagePipelineCanceledError';
    this.stage = stage;
  }
}

export function isMontagePipelineCanceled(value: unknown): value is MontagePipelineCanceledError {
  return value instanceof MontagePipelineCanceledError;
}

export function checkpoint(observer: MontagePipelineObserver | undefined, stage: MontageStage): void {
  if (observer?.cancellationRequested() === true) {
    throw new MontagePipelineCanceledError(stage);
  }
}
