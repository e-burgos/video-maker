import { ASSEMBLE_STAGES } from './render-job';
import type { AssembleJobProgress, AssembleStage } from './render-job';

function stagePercent(stage: AssembleStage): number {
  return Math.floor(((ASSEMBLE_STAGES.indexOf(stage) + 1) / ASSEMBLE_STAGES.length) * 100);
}

export function startAssembleJobStage(
  previous: AssembleJobProgress | null,
  stage: AssembleStage,
): AssembleJobProgress {
  if (previous !== null && ASSEMBLE_STAGES.indexOf(stage) <= ASSEMBLE_STAGES.indexOf(previous.stage)) {
    return previous;
  }
  return { stage, percent: stagePercent(stage) };
}
