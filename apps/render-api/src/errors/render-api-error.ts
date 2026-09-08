export const RENDER_PIPELINE_STAGES = ['prepare', 'render', 'mix', 'mux', 'verify'] as const;

export type RenderPipelineStage = (typeof RENDER_PIPELINE_STAGES)[number];

export const RENDER_API_ERROR_CODES = [
  'INVALID_TIMELINE',
  'RENDER_BUNDLE_FAILED',
  'COMPOSITION_NOT_FOUND',
  'RENDER_FAILED',
  'UNRESOLVED_AUDIO_ASSET',
  'MISSING_AUDIO_STREAM',
  'MISSING_VIDEO_STREAM',
  'MEDIA_COMMAND_FAILED',
  'MEDIA_OUTPUT_UNPARSEABLE',
  'MEDIA_BINARY_NOT_FOUND',
  'WORKDIR_UNWRITABLE',
  'ROUTE_NOT_FOUND',
  'METHOD_NOT_ALLOWED',
  'SERVER_CONFIG_INVALID',
  'INTERNAL_ERROR',
] as const;

export type RenderApiErrorCode = (typeof RENDER_API_ERROR_CODES)[number];

export interface RenderApiErrorPayload {
  readonly code: RenderApiErrorCode;
  readonly stage: RenderPipelineStage | null;
  readonly message: string;
  readonly resource?: string;
  readonly expected?: string;
  readonly hint?: string;
}

export abstract class RenderApiError extends Error {
  abstract readonly code: RenderApiErrorCode;
  abstract readonly stage: RenderPipelineStage | null;
  abstract readonly resource: string | null;
  abstract readonly expected: string | null;
  abstract readonly hint: string | null;
}

export function isRenderApiError(value: unknown): value is RenderApiError {
  return value instanceof RenderApiError;
}
