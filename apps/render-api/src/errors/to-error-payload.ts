import { isRenderApiError } from './render-api-error';
import type { RenderApiErrorCode, RenderApiErrorPayload } from './render-api-error';

const MESSAGE_BY_CODE: Readonly<Record<RenderApiErrorCode, string>> = {
  INVALID_TIMELINE: 'The submitted timeline did not pass validation.',
  RENDER_BUNDLE_FAILED: 'The renderer could not bundle the composition entry point.',
  COMPOSITION_NOT_FOUND: 'The renderer could not find the requested composition.',
  RENDER_FAILED: 'The renderer failed while producing the muted video.',
  UNRESOLVED_AUDIO_ASSET: 'An audio clip references an asset that is not in the timeline.',
  MISSING_AUDIO_STREAM: 'The referenced voice asset has no audio stream.',
  MISSING_VIDEO_STREAM: 'The rendered file has no video stream to mux into.',
  MEDIA_COMMAND_FAILED: 'A media command exited with a non-zero status.',
  MEDIA_OUTPUT_UNPARSEABLE: 'A media command ran but its output could not be parsed.',
  MEDIA_BINARY_NOT_FOUND: 'A required media binary could not be resolved.',
  WORKDIR_UNWRITABLE: 'The render working directory could not be created.',
  ROUTE_NOT_FOUND: 'No route matches the requested path.',
  METHOD_NOT_ALLOWED: 'The requested method is not allowed on this path.',
  SERVER_CONFIG_INVALID: 'The server configuration is invalid.',
  INTERNAL_ERROR: 'The service failed for an unexpected reason.',
};

export function toErrorPayload(value: unknown): RenderApiErrorPayload {
  if (!isRenderApiError(value)) {
    return { code: 'INTERNAL_ERROR', stage: null, message: MESSAGE_BY_CODE.INTERNAL_ERROR };
  }

  return {
    code: value.code,
    stage: value.stage,
    message: MESSAGE_BY_CODE[value.code],
    ...(value.resource === null ? {} : { resource: value.resource }),
    ...(value.expected === null ? {} : { expected: value.expected }),
    ...(value.hint === null ? {} : { hint: value.hint }),
  };
}
