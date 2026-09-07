import { MediaLocalError } from './media-local-error';

export const STDERR_MAX_BYTES = 2048;

export function truncateStderr(stderr: string): { text: string; truncated: boolean } {
  const buffer = Buffer.from(stderr, 'utf8');
  if (buffer.byteLength <= STDERR_MAX_BYTES) {
    return { text: stderr, truncated: false };
  }

  const tail = buffer.subarray(-STDERR_MAX_BYTES);
  const decoded = tail.toString('utf8');
  const text = decoded.charCodeAt(0) === 0xfffd ? decoded.slice(1) : decoded;
  return { text, truncated: true };
}

export class CommandFailedError extends MediaLocalError {
  readonly code = 'COMMAND_FAILED';
  readonly command: string;
  readonly args: readonly string[];
  readonly exitCode: number;
  readonly stderr: string;
  readonly stderrTruncated: boolean;

  constructor(init: { command: string; args: readonly string[]; exitCode: number; stderr: string }) {
    const { text, truncated } = truncateStderr(init.stderr);
    super(
      `El comando ${init.command} ${init.args.join(' ')} terminó con código ${init.exitCode}.`,
    );
    this.name = 'CommandFailedError';
    this.command = init.command;
    this.args = init.args;
    this.exitCode = init.exitCode;
    this.stderr = text;
    this.stderrTruncated = truncated;
  }
}
