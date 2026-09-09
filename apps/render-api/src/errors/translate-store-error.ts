import { isAutoMontageError } from '@video-maker/auto-montage';
import type { AutoMontageErrorCode } from '@video-maker/auto-montage';

import { PipelineStageError } from './pipeline-stage-error';
import type { RenderApiError, RenderApiErrorCode } from './render-api-error';

const HANDLED_AUTO_MONTAGE_CODES = [
  'CATALOG_UNREADABLE',
  'PROJECT_LAYOUT_INVALID',
  'PATH_ESCAPES_PROJECT',
  'READ_ONLY_RAW_PATH',
  'TIMELINE_INVALID',
  'EDL_INVALID',
] as const satisfies readonly AutoMontageErrorCode[];

type HandledAutoMontageCode = (typeof HANDLED_AUTO_MONTAGE_CODES)[number];

function isHandledAutoMontageCode(code: string): code is HandledAutoMontageCode {
  return (HANDLED_AUTO_MONTAGE_CODES as readonly string[]).includes(code);
}

const OWN_CODE_BY_AUTO_MONTAGE_CODE: Readonly<Record<HandledAutoMontageCode, RenderApiErrorCode>> = {
  CATALOG_UNREADABLE: 'CATALOG_UNREADABLE',
  PROJECT_LAYOUT_INVALID: 'PROJECT_LAYOUT_INVALID',
  PATH_ESCAPES_PROJECT: 'ASSET_PATH_INVALID',
  READ_ONLY_RAW_PATH: 'ASSET_PATH_INVALID',
  TIMELINE_INVALID: 'TIMELINE_INVALID',
  EDL_INVALID: 'EDL_INVALID',
};

export function translateAutoMontageError(cause: unknown, resource: string): RenderApiError {
  if (isAutoMontageError(cause) && isHandledAutoMontageCode(cause.code)) {
    return new PipelineStageError({
      code: OWN_CODE_BY_AUTO_MONTAGE_CODE[cause.code],
      stage: null,
      resource,
      cause,
    });
  }

  return new PipelineStageError({ code: 'INTERNAL_ERROR', stage: null, resource, cause });
}
