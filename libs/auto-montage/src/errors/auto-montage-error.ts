export type AutoMontageErrorCode =
  | 'PROJECT_LAYOUT_INVALID'
  | 'PATH_ESCAPES_PROJECT'
  | 'READ_ONLY_RAW_PATH'
  | 'CATALOG_UNREADABLE'
  | 'TRANSCRIPTION_FAILED'
  | 'ASSET_PROBE_FAILED'
  | 'MONTAGE_INPUT_INVALID'
  | 'ASSEMBLE_INPUT_INVALID'
  | 'EDL_INVALID'
  | 'TIMELINE_INVALID';

export abstract class AutoMontageError extends Error {
  abstract readonly code: AutoMontageErrorCode;
}

export function isAutoMontageError(value: unknown): value is AutoMontageError {
  return value instanceof AutoMontageError;
}
