import type { AutoMontageErrorCode } from '@video-maker/auto-montage';
import type { MediaLocalErrorCode } from '@video-maker/media-local';

import type { MontageStage } from '../jobs/render-job';
import { PipelineStageError } from './pipeline-stage-error';
import { isRenderApiError } from './render-api-error';
import type { RenderApiError, RenderApiErrorCode } from './render-api-error';

const HANDLED_AUTO_MONTAGE_CODES = [
  'CATALOG_UNREADABLE',
  'TIMELINE_INVALID',
  'EDL_INVALID',
  'MONTAGE_INPUT_INVALID',
] as const satisfies readonly AutoMontageErrorCode[];

const HANDLED_MEDIA_LOCAL_CODES = ['BINARY_NOT_FOUND'] as const satisfies readonly MediaLocalErrorCode[];

type HandledAutoMontageCode = (typeof HANDLED_AUTO_MONTAGE_CODES)[number];
type HandledMediaLocalCode = (typeof HANDLED_MEDIA_LOCAL_CODES)[number];

const AUTO_MONTAGE_CODE_MAP: Readonly<Record<HandledAutoMontageCode, RenderApiErrorCode>> = {
  CATALOG_UNREADABLE: 'CATALOG_UNREADABLE',
  TIMELINE_INVALID: 'TIMELINE_INVALID',
  EDL_INVALID: 'EDL_INVALID',
  MONTAGE_INPUT_INVALID: 'MONTAGE_INPUT_INVALID',
};

interface EngineErrorShape {
  readonly code: string;
}

function asEngineError(value: unknown): EngineErrorShape | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const candidate = value as { code?: unknown };
  return typeof candidate.code === 'string' ? { code: candidate.code } : null;
}

function isHandledAutoMontageCode(code: string): code is HandledAutoMontageCode {
  return (HANDLED_AUTO_MONTAGE_CODES as readonly string[]).includes(code);
}

function isHandledMediaLocalCode(code: string): code is HandledMediaLocalCode {
  return (HANDLED_MEDIA_LOCAL_CODES as readonly string[]).includes(code);
}

export function translateMontageError(
  cause: unknown,
  stage: MontageStage,
  resource: string | null,
): RenderApiError {
  if (isRenderApiError(cause)) {
    return cause;
  }

  const engineError = asEngineError(cause);

  if (engineError !== null && isHandledMediaLocalCode(engineError.code)) {
    return new PipelineStageError({
      code: 'MEDIA_BINARY_NOT_FOUND',
      stage,
      resource,
      hint: 'set FFMPEG_PATH, FFPROBE_PATH, WHISPER_CPP_PATH and WHISPER_MODEL_PATH or install the binaries in PATH',
      cause,
    });
  }

  if (engineError !== null && isHandledAutoMontageCode(engineError.code)) {
    return new PipelineStageError({
      code: AUTO_MONTAGE_CODE_MAP[engineError.code],
      stage,
      resource,
      cause,
    });
  }

  return new PipelineStageError({ code: 'MONTAGE_FAILED', stage, resource, cause });
}
