import type { RenderProgressListener } from '../deps/render-api-dependencies';
import type { RenderPipelineStage } from '../errors/render-api-error';

export interface RenderPipelineObserver {
  readonly stageStarted: (stage: RenderPipelineStage) => void;
  readonly renderProgressed: RenderProgressListener;
  readonly cancellationRequested: () => boolean;
}

export class RenderPipelineCanceledError extends Error {
  readonly stage: RenderPipelineStage;

  constructor(stage: RenderPipelineStage) {
    super(`Render pipeline canceled before the ${stage} stage.`);
    this.name = 'RenderPipelineCanceledError';
    this.stage = stage;
  }
}

export function isRenderPipelineCanceled(value: unknown): value is RenderPipelineCanceledError {
  return value instanceof RenderPipelineCanceledError;
}
