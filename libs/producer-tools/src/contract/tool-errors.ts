export const STUDIO_TOOL_ERROR_CODES = [
  'INVALID_INPUT',
  'PATH_OUTSIDE_PROJECT',
  'PATH_NOT_WRITABLE',
  'FILE_NOT_FOUND',
  'FILE_TOO_LARGE',
  'ASSET_EXISTS',
  'JOB_REJECTED',
  'JOB_NOT_FOUND',
  'STUDIO_UNAVAILABLE',
  'MUSIC_SOURCE_UNAVAILABLE',
  'MUSIC_RESULT_UNKNOWN',
  'MEDIA_SOURCE_UNAVAILABLE',
  'MEDIA_RESULT_UNKNOWN',
  'PROPOSAL_NOT_APPROVED',
] as const;

export type StudioToolErrorCode = (typeof STUDIO_TOOL_ERROR_CODES)[number];

export interface StudioToolError {
  readonly code: StudioToolErrorCode;
  readonly hint: string;
}

function isStudioToolErrorCode(value: unknown): value is StudioToolErrorCode {
  return (
    typeof value === 'string' &&
    (STUDIO_TOOL_ERROR_CODES as readonly string[]).includes(value)
  );
}

export function isStudioToolError(value: unknown): value is StudioToolError {
  return (
    typeof value === 'object' &&
    value !== null &&
    isStudioToolErrorCode((value as Record<string, unknown>).code) &&
    typeof (value as Record<string, unknown>).hint === 'string'
  );
}
