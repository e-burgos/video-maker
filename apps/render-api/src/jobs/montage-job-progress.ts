import { MONTAGE_STAGES } from './render-job';
import type { MontageJobProgress, MontageStage } from './render-job';

export function montageProgressPercent(processed: number, total: number): number | null {
  if (total <= 0) {
    return null;
  }
  return Math.min(100, Math.max(0, Math.floor((processed / total) * 100)));
}

export function startMontageJobStage(
  previous: MontageJobProgress | null,
  stage: MontageStage,
): MontageJobProgress {
  if (previous !== null && MONTAGE_STAGES.indexOf(stage) <= MONTAGE_STAGES.indexOf(previous.stage)) {
    return previous;
  }
  return { stage, processedAssets: null, totalAssets: null, percent: null };
}

export function mergeMontageJobProgress(
  previous: MontageJobProgress | null,
  stage: 'probe' | 'transcribe',
  totalAssets: number,
): MontageJobProgress {
  if (previous !== null && previous.stage !== stage) {
    return previous;
  }
  const processedAssets = (previous?.processedAssets ?? 0) + 1;
  return { stage, processedAssets, totalAssets, percent: montageProgressPercent(processedAssets, totalAssets) };
}
