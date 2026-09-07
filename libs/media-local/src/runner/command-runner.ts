export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface CommandOptions {
  cwd?: string;
  timeoutMs?: number;
}

export interface CommandRunner {
  run(bin: string, args: readonly string[], opts?: CommandOptions): Promise<CommandResult>;
}
