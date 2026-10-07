export type MotionStudioErrorCode =
  | 'SCRIPT_INVALID'
  | 'BEATS_INVALID'
  | 'WORD_NOT_FOUND'
  | 'TEMPLATE_VALUE_MISSING'
  | 'CLI_USAGE'
  | 'STAGE_FAILED'
  | 'STORYBOARD_INVALID'
  | 'BRAND_INVALID'
  | 'ASSET_MISSING'
  | 'BRIEF_INVALID'
  | 'AI_FAILED';

export class MotionStudioError extends Error {
  readonly code: MotionStudioErrorCode;

  constructor(code: MotionStudioErrorCode, message: string) {
    super(message);
    this.name = 'MotionStudioError';
    this.code = code;
  }
}

export function isMotionStudioError(value: unknown): value is MotionStudioError {
  return value instanceof MotionStudioError;
}
