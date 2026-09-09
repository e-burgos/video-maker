import { RenderCliError } from './render-cli-error';
import type { RenderCliErrorCode, Stage } from './render-cli-error';

export class CliUsageError extends RenderCliError {
  readonly code: RenderCliErrorCode = 'CLI_USAGE';
  readonly stage: Stage | null;
  readonly resource: string | null;
  readonly reason: string;
  readonly expected: string | null;
  readonly hint: string | null = null;

  constructor(init: { reason: string; stage?: Stage | null; resource?: string | null; expected?: string | null }) {
    super(init.reason);
    this.name = 'CliUsageError';
    this.stage = init.stage ?? null;
    this.reason = init.reason;
    this.resource = init.resource ?? null;
    this.expected = init.expected ?? null;
  }
}
