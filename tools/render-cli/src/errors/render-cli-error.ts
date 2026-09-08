export type Stage = 'ingest' | 'plan' | 'render';

export type RenderCliErrorCode = 'CLI_USAGE' | 'CLI_ARGUMENT' | 'STAGE_INPUT_MISSING' | 'STAGE_FAILED';

export abstract class RenderCliError extends Error {
  abstract readonly code: RenderCliErrorCode;
  abstract readonly stage: Stage | null;
  abstract readonly resource: string | null;
  abstract readonly reason: string;
  abstract readonly expected: string | null;
  abstract readonly hint: string | null;
}

export function isRenderCliError(value: unknown): value is RenderCliError {
  return value instanceof RenderCliError;
}
