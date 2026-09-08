import { RenderCliError } from './render-cli-error';
import type { RenderCliErrorCode, Stage } from './render-cli-error';

export class StageInputMissingError extends RenderCliError {
  readonly code: RenderCliErrorCode = 'STAGE_INPUT_MISSING';
  readonly stage: Stage;
  readonly resource: string | null;
  readonly reason: string;
  readonly expected: string | null = null;
  readonly hint: string | null;

  constructor(init: { stage: Stage; resource: string; reason: string; hint?: string | null }) {
    super(init.reason);
    this.name = 'StageInputMissingError';
    this.stage = init.stage;
    this.resource = init.resource;
    this.reason = init.reason;
    this.hint = init.hint ?? null;
  }
}
