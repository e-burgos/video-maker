import { access, constants } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';

const START_MARKER = '__video_maker_login_path_start__';
const END_MARKER = '__video_maker_login_path_end__';
const DEFAULT_SHELL = '/bin/zsh';
const DEFAULT_TIMEOUT_MS = 5000;

export interface CommandResult {
  readonly stdout: string;
  readonly exitCode: number | null;
  readonly timedOut: boolean;
}

export interface CommandRunner {
  run(command: string, args: readonly string[], opts: { timeoutMs: number }): Promise<CommandResult>;
}

function killProcessGroup(child: ChildProcess): void {
  if (child.pid === undefined) {
    return;
  }
  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    child.kill('SIGKILL');
  }
}

export const nodeCommandRunner: CommandRunner = {
  run(command, args, { timeoutMs }) {
    return new Promise((resolve) => {
      const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'ignore'], detached: true });
      let stdout = '';
      let settled = false;

      const settle = (result: CommandResult): void => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        resolve(result);
      };

      const timer = setTimeout(() => {
        killProcessGroup(child);
        settle({ stdout, exitCode: null, timedOut: true });
      }, timeoutMs);

      child.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8');
      });
      child.on('error', () => {
        settle({ stdout, exitCode: null, timedOut: false });
      });
      child.on('close', (code) => {
        settle({ stdout, exitCode: code, timedOut: false });
      });
    });
  },
};

function loginShellPathCommand(): string {
  return `printf '%s' '${START_MARKER}'; printf '%s' "$PATH"; printf '%s' '${END_MARKER}'`;
}

function extractMarkedPath(stdout: string): string | null {
  const startIndex = stdout.indexOf(START_MARKER);
  const endIndex = stdout.indexOf(END_MARKER);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return null;
  }
  const path = stdout.slice(startIndex + START_MARKER.length, endIndex).trim();
  return path === '' ? null : path;
}

export interface ReadLoginShellPathOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly runner?: CommandRunner;
  readonly timeoutMs?: number;
}

export async function readLoginShellPath(options: ReadLoginShellPathOptions = {}): Promise<string | null> {
  const env = options.env ?? process.env;
  const runner = options.runner ?? nodeCommandRunner;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const shell = env.SHELL !== undefined && env.SHELL !== '' ? env.SHELL : DEFAULT_SHELL;

  const result = await runner.run(shell, ['-ilc', loginShellPathCommand()], { timeoutMs });
  if (result.timedOut || result.exitCode !== 0) {
    return null;
  }
  return extractMarkedPath(result.stdout);
}

export function mergePathWithDefault(loginPath: string | null, currentPath: string): string {
  if (loginPath === null) {
    return currentPath;
  }

  const seen = new Set<string>();
  const merged: string[] = [];
  for (const dir of [...loginPath.split(':'), ...currentPath.split(':')]) {
    if (dir !== '' && !seen.has(dir)) {
      seen.add(dir);
      merged.push(dir);
    }
  }
  return merged.join(':');
}

export interface ExecutableLookup {
  isExecutableFile(path: string): Promise<boolean>;
}

export const nodeExecutableLookup: ExecutableLookup = {
  async isExecutableFile(path) {
    try {
      await access(path, constants.X_OK);
      return true;
    } catch {
      return false;
    }
  },
};

function knownClaudeCliLocations(home: string): readonly string[] {
  return [
    join(home, '.local', 'bin', 'claude'),
    '/opt/homebrew/bin/claude',
    '/usr/local/bin/claude',
    join(home, '.claude', 'local', 'claude'),
  ];
}

export interface ResolveClaudeCliOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly homeDir?: string;
  readonly lookup?: ExecutableLookup;
  readonly loginShellPath?: string | null;
}

export async function resolveClaudeCli(options: ResolveClaudeCliOptions = {}): Promise<string | null> {
  const env = options.env ?? process.env;
  const lookup = options.lookup ?? nodeExecutableLookup;

  const fromEnv = env.CLAUDE_CLI_PATH;
  if (fromEnv !== undefined && fromEnv !== '' && (await lookup.isExecutableFile(fromEnv))) {
    return fromEnv;
  }

  const loginPath = options.loginShellPath ?? null;
  if (loginPath !== null) {
    for (const dir of loginPath.split(':')) {
      if (dir === '') continue;
      const candidate = join(dir, 'claude');
      if (await lookup.isExecutableFile(candidate)) {
        return candidate;
      }
    }
  }

  const home = options.homeDir ?? homedir();
  for (const candidate of knownClaudeCliLocations(home)) {
    if (await lookup.isExecutableFile(candidate)) {
      return candidate;
    }
  }

  return null;
}
