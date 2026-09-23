import { PHOTO_AROLL_STAGES } from './render-job';
import type { PhotoArollJobProgress, PhotoArollStage } from './render-job';

export function photoArollProgressPercent(processed: number, total: number): number | null {
  if (total <= 0) {
    return null;
  }
  return Math.min(100, Math.max(0, Math.floor((processed / total) * 100)));
}

export function startPhotoArollJobStage(
  previous: PhotoArollJobProgress | null,
  stage: PhotoArollStage,
): PhotoArollJobProgress {
  if (previous !== null && PHOTO_AROLL_STAGES.indexOf(stage) <= PHOTO_AROLL_STAGES.indexOf(previous.stage)) {
    return previous;
  }
  return { stage, processedClips: null, totalClips: null, percent: null };
}

export function mergePhotoArollJobProgress(
  previous: PhotoArollJobProgress | null,
  totalClips: number,
): PhotoArollJobProgress {
  if (previous !== null && previous.stage !== 'clips') {
    return previous;
  }
  const processedClips = (previous?.processedClips ?? 0) + 1;
  return {
    stage: 'clips',
    processedClips,
    totalClips,
    percent: photoArollProgressPercent(processedClips, totalClips),
  };
}
