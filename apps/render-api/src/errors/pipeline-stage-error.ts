import { RenderApiError } from './render-api-error';
import type { RenderApiErrorCode, RenderApiErrorDetails, RenderApiErrorStage } from './render-api-error';

export class PipelineStageError extends RenderApiError {
  readonly code: RenderApiErrorCode;
  readonly stage: RenderApiErrorStage | null;
  readonly resource: string | null;
  readonly expected: string | null;
  readonly hint: string | null;
  readonly details: RenderApiErrorDetails | null;

  constructor(init: {
    code: RenderApiErrorCode;
    stage: RenderApiErrorStage | null;
    resource?: string | null;
    expected?: string | null;
    hint?: string | null;
    details?: RenderApiErrorDetails | null;
    cause?: unknown;
  }) {
    super(init.code, init.cause === undefined ? {} : { cause: init.cause });
    this.name = 'PipelineStageError';
    this.code = init.code;
    this.stage = init.stage;
    this.resource = init.resource ?? null;
    this.expected = init.expected ?? null;
    this.hint = init.hint ?? null;
    this.details = init.details ?? null;
  }
}
