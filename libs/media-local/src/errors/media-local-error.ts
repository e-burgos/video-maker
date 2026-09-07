export type MediaLocalErrorCode = 'BINARY_NOT_FOUND' | 'COMMAND_FAILED' | 'UNPARSEABLE_OUTPUT';

export abstract class MediaLocalError extends Error {
  abstract readonly code: MediaLocalErrorCode;
}

export function isMediaLocalError(value: unknown): value is MediaLocalError {
  return value instanceof MediaLocalError;
}
