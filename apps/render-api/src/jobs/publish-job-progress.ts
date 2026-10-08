import { PUBLISH_STAGES } from './render-job';
import type { PublishJobProgress, PublishStage } from './render-job';

const UPLOAD_MAX_PERCENT = 99;

function stagePercent(stage: PublishStage): number {
  return stage === 'prepare' ? 0 : UPLOAD_MAX_PERCENT;
}

export function startPublishJobStage(previous: PublishJobProgress | null, stage: PublishStage): PublishJobProgress {
  if (previous !== null && PUBLISH_STAGES.indexOf(stage) <= PUBLISH_STAGES.indexOf(previous.stage)) {
    return previous;
  }
  return {
    stage,
    uploadedBytes: stage === 'upload' ? 0 : (previous?.uploadedBytes ?? null),
    totalBytes: previous?.totalBytes ?? null,
    percent: stage === 'upload' ? 0 : stagePercent(stage),
  };
}

export function mergePublishUploadProgress(
  previous: PublishJobProgress | null,
  uploadedBytes: number,
  totalBytes: number,
): PublishJobProgress {
  if (previous !== null && previous.stage !== 'upload') {
    return previous;
  }
  const fraction = totalBytes <= 0 ? 0 : Math.min(1, uploadedBytes / totalBytes);
  return {
    stage: 'upload',
    uploadedBytes,
    totalBytes,
    percent: Math.min(UPLOAD_MAX_PERCENT, Math.floor(fraction * 100)),
  };
}

export function completePublishJobProgress(previous: PublishJobProgress | null): PublishJobProgress | null {
  return previous === null ? null : { ...previous, percent: 100 };
}
