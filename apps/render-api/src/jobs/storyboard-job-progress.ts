import { STORYBOARD_STAGES } from './render-job';
import type { StoryboardJobProgress, StoryboardStage } from './render-job';

export function storyboardStagePercent(stage: StoryboardStage): number {
  return Math.floor(((STORYBOARD_STAGES.indexOf(stage) + 1) / STORYBOARD_STAGES.length) * 100);
}

export function startStoryboardJobStage(
  previous: StoryboardJobProgress | null,
  stage: StoryboardStage,
): StoryboardJobProgress {
  if (previous !== null && STORYBOARD_STAGES.indexOf(stage) <= STORYBOARD_STAGES.indexOf(previous.stage)) {
    return previous;
  }
  return { stage, percent: storyboardStagePercent(stage) };
}
