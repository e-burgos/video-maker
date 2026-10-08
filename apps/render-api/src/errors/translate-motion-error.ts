import { isMotionStudioError } from '@video-maker/motion-graphics';
import type { MotionStudioErrorCode } from '@video-maker/motion-graphics';

import { ACCEPTED_IMAGE_REF_FORMAT } from '../motion/validate-storyboard-images';
import { PipelineStageError } from './pipeline-stage-error';
import { isRenderApiError } from './render-api-error';
import type { RenderApiError, RenderApiErrorCode, RenderApiErrorStage } from './render-api-error';

const OWN_CODE_BY_MOTION_CODE: Readonly<Record<MotionStudioErrorCode, RenderApiErrorCode>> = {
  SCRIPT_INVALID: 'MOTION_PIPELINE_FAILED',
  BEATS_INVALID: 'MOTION_PIPELINE_FAILED',
  WORD_NOT_FOUND: 'MOTION_PIPELINE_FAILED',
  TEMPLATE_VALUE_MISSING: 'MOTION_PIPELINE_FAILED',
  CLI_USAGE: 'MOTION_PIPELINE_FAILED',
  STAGE_FAILED: 'MOTION_PIPELINE_FAILED',
  STORYBOARD_INVALID: 'STORYBOARD_INVALID',
  BRAND_INVALID: 'SERVER_CONFIG_INVALID',
  ASSET_MISSING: 'FILE_NOT_FOUND',
  BRIEF_INVALID: 'BRIEF_INVALID',
  AI_FAILED: 'AI_AGENT_FAILED',
};

export function translateMotionError(
  cause: unknown,
  stage: RenderApiErrorStage | null,
  resource: string | null,
): RenderApiError | null {
  if (!isMotionStudioError(cause)) {
    return null;
  }
  if (cause.code === 'AI_FAILED' && isRenderApiError(cause.cause)) {
    const agentError = cause.cause;
    return new PipelineStageError({
      code: agentError.code,
      stage,
      resource: agentError.resource,
      expected: agentError.expected,
      hint: agentError.hint,
      details: agentError.details,
      cause: agentError,
    });
  }
  return new PipelineStageError({
    code: OWN_CODE_BY_MOTION_CODE[cause.code],
    stage,
    resource,
    expected: cause.code === 'ASSET_MISSING' ? `${cause.message}; image refs must be ${ACCEPTED_IMAGE_REF_FORMAT}` : cause.message,
    cause,
  });
}
