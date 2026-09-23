import type { MediaLocalErrorCode } from '@video-maker/media-local';

import type { VoiceStage } from '../jobs/render-job';
import { PipelineStageError } from './pipeline-stage-error';
import { isRenderApiError } from './render-api-error';
import type { RenderApiError, RenderApiErrorCode } from './render-api-error';

const BINARY_MISSING_CODE = 'BINARY_NOT_FOUND' as const satisfies MediaLocalErrorCode;

const FAILURE_CODE_BY_STAGE: Readonly<Record<VoiceStage, RenderApiErrorCode>> = {
  synthesize: 'VOICE_SYNTHESIS_FAILED',
  transcribe: 'VOICE_TRANSCRIPTION_FAILED',
  persist: 'INTERNAL_ERROR',
};

const MISSING_BINARY_HINT = 'set TTS_CLI_PATH and TTS_VOICES_DIR, and WHISPER_CPP_PATH with WHISPER_MODEL_PATH';

function engineErrorCode(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const candidate = value as { code?: unknown };
  return typeof candidate.code === 'string' ? candidate.code : null;
}

export function translateVoiceError(
  cause: unknown,
  stage: VoiceStage | null,
  resource: string | null,
): RenderApiError {
  if (isRenderApiError(cause)) {
    return cause;
  }

  if (engineErrorCode(cause) === BINARY_MISSING_CODE) {
    return new PipelineStageError({
      code: 'VOICE_MODEL_UNAVAILABLE',
      stage,
      resource,
      hint: MISSING_BINARY_HINT,
      cause,
    });
  }

  return new PipelineStageError({
    code: stage === null ? 'INTERNAL_ERROR' : FAILURE_CODE_BY_STAGE[stage],
    stage,
    resource,
    cause,
  });
}
