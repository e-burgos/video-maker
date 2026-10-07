import { MOTION_STAGES } from './render-job';
import type { MotionJobProgress, MotionStage } from './render-job';

function stagePercent(stage: MotionStage, fraction: number): number {
  return Math.min(100, Math.floor(((MOTION_STAGES.indexOf(stage) + fraction) / MOTION_STAGES.length) * 100));
}

export function startMotionJobStage(previous: MotionJobProgress | null, stage: MotionStage): MotionJobProgress {
  if (previous !== null && MOTION_STAGES.indexOf(stage) <= MOTION_STAGES.indexOf(previous.stage)) {
    return previous;
  }
  return { stage, linesVoiced: null, totalLines: null, percent: stagePercent(stage, 0) };
}

export function mergeMotionVoiceProgress(
  previous: MotionJobProgress | null,
  linesVoiced: number,
  totalLines: number,
): MotionJobProgress {
  if (previous !== null && previous.stage !== 'voice') {
    return previous;
  }
  const fraction = totalLines <= 0 ? 0 : Math.min(1, linesVoiced / totalLines);
  return { stage: 'voice', linesVoiced, totalLines, percent: stagePercent('voice', fraction) };
}
