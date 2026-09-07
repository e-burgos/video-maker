import { execa } from 'execa';

import { BinaryNotFoundError } from '../errors/binary-not-found-error';
import { CommandFailedError } from '../errors/command-failed-error';
import type { CommandOptions, CommandResult, CommandRunner } from './command-runner';

export interface ExecaCommandRunnerOptions {
  defaultTimeoutMs?: number;
  cwd?: string;
}

export const SPAWN_FAILURE_EXIT_CODE = -1;

const DEFAULT_TIMEOUT_MS = 600_000;

export interface ExecaLikeResult {
  stdout: string;
  stderr: string;
  exitCode?: number | undefined;
  code?: string | undefined;
  message?: string | undefined;
}

export function mapExecaResult(
  bin: string,
  args: readonly string[],
  result: ExecaLikeResult,
): CommandResult {
  if (typeof result.exitCode === 'number') {
    return { stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode };
  }

  if (result.code === 'ENOENT') {
    throw new BinaryNotFoundError({ binary: bin });
  }

  throw new CommandFailedError({
    command: bin,
    args,
    exitCode: SPAWN_FAILURE_EXIT_CODE,
    stderr: result.stderr || result.message || '',
  });
}

export class ExecaCommandRunner implements CommandRunner {
  private readonly defaultTimeoutMs: number;
  private readonly cwd: string | undefined;

  constructor(opts?: ExecaCommandRunnerOptions) {
    this.defaultTimeoutMs = opts?.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.cwd = opts?.cwd;
  }

  async run(bin: string, args: readonly string[], opts?: CommandOptions): Promise<CommandResult> {
    const cwd = opts?.cwd ?? this.cwd;
    const result = await execa(bin, [...args], {
      reject: false,
      all: false,
      encoding: 'utf8',
      stripFinalNewline: false,
      timeout: opts?.timeoutMs ?? this.defaultTimeoutMs,
      ...(cwd !== undefined ? { cwd } : {}),
    });

    return mapExecaResult(bin, args, result);
  }
}
