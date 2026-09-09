import type { MontageStage } from '../jobs/render-job';

export const RENDER_PIPELINE_STAGES = ['prepare', 'render', 'mix', 'mux', 'verify'] as const;

export type RenderPipelineStage = (typeof RENDER_PIPELINE_STAGES)[number];

export type RenderApiErrorStage = RenderPipelineStage | MontageStage;

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
  'PROJECT_NOT_FOUND',
  'PROJECT_SLUG_INVALID',
  'PROJECT_ALREADY_EXISTS',
  'PROJECT_LAYOUT_INVALID',
  'ASSET_ROLE_INVALID',
  'ASSET_PATH_INVALID',
  'ASSET_ALREADY_EXISTS',
  'ASSET_CONTENT_LENGTH_REQUIRED',
  'ASSET_CONTENT_TYPE_REQUIRED',
  'ASSET_TOO_LARGE',
  'ASSET_UPLOAD_ABORTED',
  'TIMELINE_NOT_FOUND',
  'TIMELINE_INVALID',
  'EDL_NOT_FOUND',
  'EDL_INVALID',
  'ARTIFACT_NOT_FOUND',
  'RANGE_NOT_SATISFIABLE',
  'CATALOG_UNREADABLE',
  'REQUEST_BODY_INVALID_JSON',
  'REQUEST_BODY_TOO_LARGE',
  'RENDER_JOB_NOT_FOUND',
  'RENDER_JOB_NOT_CANCELABLE',
  'JOB_KIND_INVALID',
  'MONTAGE_PRESET_INVALID',
  'MONTAGE_SEED_INVALID',
  'MONTAGE_OVERWRITE_INVALID',
  'TIMELINE_ALREADY_EXISTS',
  'MONTAGE_RAW_MISSING',
  'MONTAGE_INPUT_INVALID',
  'MONTAGE_FAILED',
] as const;

export type RenderApiErrorCode = (typeof RENDER_API_ERROR_CODES)[number];

export interface RenderApiErrorDetails {
  readonly assetPersisted?: boolean;
  readonly catalogUpdated?: boolean;
}

export interface RenderApiErrorPayload {
  readonly code: RenderApiErrorCode;
  readonly stage: RenderApiErrorStage | null;
  readonly message: string;
  readonly resource?: string;
  readonly expected?: string;
  readonly hint?: string;
  readonly assetPersisted?: boolean;
  readonly catalogUpdated?: boolean;
}

export abstract class RenderApiError extends Error {
  abstract readonly code: RenderApiErrorCode;
  abstract readonly stage: RenderApiErrorStage | null;
  abstract readonly resource: string | null;
  abstract readonly expected: string | null;
  abstract readonly hint: string | null;
  abstract readonly details: RenderApiErrorDetails | null;
}

export function isRenderApiError(value: unknown): value is RenderApiError {
  return value instanceof RenderApiError;
}
