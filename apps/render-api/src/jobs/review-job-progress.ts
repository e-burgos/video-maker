import { REVIEW_STAGES } from './render-job';
import type { ReviewJobProgress, ReviewStage } from './render-job';

export function startReviewJobStage(previous: ReviewJobProgress | null, stage: ReviewStage): ReviewJobProgress {
  if (previous !== null && REVIEW_STAGES.indexOf(stage) <= REVIEW_STAGES.indexOf(previous.stage)) {
    return previous;
  }
  return { stage, percent: Math.floor((REVIEW_STAGES.indexOf(stage) / REVIEW_STAGES.length) * 100) };
}

export function completeReviewJobProgress(previous: ReviewJobProgress | null): ReviewJobProgress | null {
  return previous === null ? null : { ...previous, percent: 100 };
}
