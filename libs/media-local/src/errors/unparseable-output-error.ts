import { MediaLocalError } from './media-local-error';

export const SAMPLE_MAX_CHARS = 512;

export class UnparseableOutputError extends MediaLocalError {
  readonly code = 'UNPARSEABLE_OUTPUT';
  readonly command: string;
  readonly reason: string;
  readonly sample: string;

  constructor(init: { command: string; reason: string; sample: string; cause?: unknown }) {
    super(`No se pudo interpretar la salida de ${init.command}: ${init.reason}`);
    this.name = 'UnparseableOutputError';
    this.command = init.command;
    this.reason = init.reason;
    this.sample = init.sample.slice(0, SAMPLE_MAX_CHARS);
    this.cause = init.cause;
  }
}
