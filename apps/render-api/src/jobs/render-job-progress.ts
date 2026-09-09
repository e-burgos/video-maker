import type { RenderPipelineStage } from '../errors/render-api-error';
import type { RenderJobProgress } from './render-job';

export function progressPercent(renderedFrames: number, totalFrames: number): number | null {
  if (totalFrames <= 0) {
    return null;
  }
  return Math.min(100, Math.max(0, Math.floor((renderedFrames / totalFrames) * 100)));
}

export function startRenderJobStage(
  previous: RenderJobProgress | null,
  stage: RenderPipelineStage,
): RenderJobProgress {
  return { stage, renderedFrames: null, totalFrames: null, percent: null };
}

export function mergeRenderProgress(
  previous: RenderJobProgress | null,
  renderedFrames: number,
  totalFrames: number,
): RenderJobProgress {
  if (previous !== null && previous.stage !== 'render') {
    return previous;
  }
  if (previous !== null && previous.renderedFrames !== null && renderedFrames < previous.renderedFrames) {
    return previous;
  }
  return { stage: 'render', renderedFrames, totalFrames, percent: progressPercent(renderedFrames, totalFrames) };
}
