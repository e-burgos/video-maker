import { isAutoMontageError } from '@video-maker/auto-montage';
import { isMediaLocalError } from '@video-maker/media-local';

import { StageFailedError } from './stage-failed-error';
import type { Stage } from './render-cli-error';
import type { RenderCliError } from './render-cli-error';

export function translateLibError(cause: unknown, stage: Stage, resource: string | null): RenderCliError {
  if (isAutoMontageError(cause) || isMediaLocalError(cause)) {
    return new StageFailedError({ stage, resource, reason: cause.code, cause });
  }
  throw cause;
}
