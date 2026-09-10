import type { MontageStage, StoryboardStage, VoiceStage } from '../jobs/render-job';

export const RENDER_PIPELINE_STAGES = ['prepare', 'render', 'mix', 'mux', 'verify'] as const;

export type RenderPipelineStage = (typeof RENDER_PIPELINE_STAGES)[number];

export type RenderApiErrorStage = RenderPipelineStage | MontageStage | StoryboardStage | VoiceStage;

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
  'MONTAGE_SCRIPT_INVALID',
  'MONTAGE_SCRIPT_NOT_FOUND',
  'MONTAGE_LOGO_INVALID',
  'TIMELINE_ALREADY_EXISTS',
  'MONTAGE_RAW_MISSING',
  'MONTAGE_INPUT_INVALID',
  'MONTAGE_FAILED',
  'AI_AGENT_UNAVAILABLE',
  'AI_AGENT_RATE_LIMITED',
  'AI_AGENT_FAILED',
  'AI_AGENT_INVALID_OUTPUT',
  'STORYBOARD_NOT_FOUND',
  'STORYBOARD_INVALID',
  'STORYBOARD_ALREADY_EXISTS',
  'STORYBOARD_INPUT_INVALID',
  'STORYBOARD_OVERWRITE_INVALID',
  'VOICE_MODEL_UNAVAILABLE',
  'VOICE_SYNTHESIS_FAILED',
  'VOICE_TRANSCRIPTION_FAILED',
  'VOICE_NOT_FOUND',
  'VOICE_INVALID',
  'VOICE_ALREADY_EXISTS',
  'VOICE_SCENE_NOT_FOUND',
  'VOICE_ID_INVALID',
  'VOICE_SCENE_IDS_INVALID',
  'VOICE_OVERWRITE_INVALID',
  'VOICE_ASSET_NOT_FOUND',
  'PRODUCER_UNAVAILABLE',
  'PRODUCER_TURN_ACTIVE',
  'PRODUCER_TURN_FAILED',
  'PRODUCER_RATE_LIMITED',
  'PRODUCER_TURN_NOT_FOUND',
  'PRODUCER_TURN_NOT_CANCELABLE',
  'PRODUCER_MESSAGE_INVALID',
  'PRODUCER_MODEL_INVALID',
  'PRODUCER_STATE_INVALID',
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
