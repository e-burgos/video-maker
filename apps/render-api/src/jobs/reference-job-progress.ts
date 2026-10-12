import { REFERENCE_STAGES } from './render-job';
import type { ReferenceJobProgress, ReferenceStage } from './render-job';

export function startReferenceJobStage(previous: ReferenceJobProgress | null, stage: ReferenceStage): ReferenceJobProgress {
  if (previous !== null && REFERENCE_STAGES.indexOf(stage) <= REFERENCE_STAGES.indexOf(previous.stage)) {
    return previous;
  }
  return { stage, percent: Math.floor((REFERENCE_STAGES.indexOf(stage) / REFERENCE_STAGES.length) * 100) };
}

export function completeReferenceJobProgress(previous: ReferenceJobProgress | null): ReferenceJobProgress | null {
  return previous === null ? null : { ...previous, percent: 100 };
}
