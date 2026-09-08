import { RenderCliError } from './render-cli-error';
import type { RenderCliErrorCode, Stage } from './render-cli-error';

export class StageFailedError extends RenderCliError {
  readonly code: RenderCliErrorCode = 'STAGE_FAILED';
  readonly stage: Stage;
  readonly resource: string | null;
  readonly reason: string;
  readonly expected: string | null = null;
  readonly hint: string | null = null;

  constructor(init: { stage: Stage; resource: string | null; reason: string; cause: unknown }) {
    super(init.reason, { cause: init.cause });
    this.name = 'StageFailedError';
    this.stage = init.stage;
    this.resource = init.resource;
    this.reason = init.reason;
  }
}
