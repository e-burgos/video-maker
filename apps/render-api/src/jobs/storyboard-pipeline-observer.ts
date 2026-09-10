import type { StoryboardStage } from './render-job';

export interface StoryboardPipelineObserver {
  readonly stageStarted: (stage: StoryboardStage) => void;
  readonly cancellationRequested: () => boolean;
}

export class StoryboardPipelineCanceledError extends Error {
  readonly stage: StoryboardStage;

  constructor(stage: StoryboardStage) {
    super(`Storyboard pipeline canceled before the ${stage} stage.`);
    this.name = 'StoryboardPipelineCanceledError';
    this.stage = stage;
  }
}

export function isStoryboardPipelineCanceled(value: unknown): value is StoryboardPipelineCanceledError {
  return value instanceof StoryboardPipelineCanceledError;
}

export function storyboardCheckpoint(
  observer: StoryboardPipelineObserver | undefined,
  stage: StoryboardStage,
): void {
  if (observer?.cancellationRequested() === true) {
    throw new StoryboardPipelineCanceledError(stage);
  }
}
