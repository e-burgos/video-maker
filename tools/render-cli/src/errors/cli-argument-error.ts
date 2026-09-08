import { RenderCliError } from './render-cli-error';
import type { RenderCliErrorCode, Stage } from './render-cli-error';

export class CliArgumentError extends RenderCliError {
  readonly code: RenderCliErrorCode = 'CLI_ARGUMENT';
  readonly stage: Stage;
  readonly resource: string | null;
  readonly reason: string;
  readonly expected: string | null;
  readonly hint: string | null = null;

  constructor(init: { stage: Stage; reason: string; resource?: string | null; expected?: string | null }) {
    super(init.reason);
    this.name = 'CliArgumentError';
    this.stage = init.stage;
    this.reason = init.reason;
    this.resource = init.resource ?? null;
    this.expected = init.expected ?? null;
  }
}
