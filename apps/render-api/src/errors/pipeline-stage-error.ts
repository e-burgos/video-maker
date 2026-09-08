import { RenderApiError } from './render-api-error';
import type { RenderApiErrorCode, RenderPipelineStage } from './render-api-error';

export class PipelineStageError extends RenderApiError {
  readonly code: RenderApiErrorCode;
  readonly stage: RenderPipelineStage | null;
  readonly resource: string | null;
  readonly expected: string | null;
  readonly hint: string | null;

  constructor(init: {
    code: RenderApiErrorCode;
    stage: RenderPipelineStage | null;
    resource?: string | null;
    expected?: string | null;
    hint?: string | null;
    cause?: unknown;
  }) {
    super(init.code, init.cause === undefined ? {} : { cause: init.cause });
    this.name = 'PipelineStageError';
    this.code = init.code;
    this.stage = init.stage;
    this.resource = init.resource ?? null;
    this.expected = init.expected ?? null;
    this.hint = init.hint ?? null;
  }
}
