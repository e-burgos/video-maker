import type { CommandRunner } from './login-shell-path';
import { nodeCommandRunner } from './login-shell-path';

const VERSION_TIMEOUT_MS = 5000;
const AUTH_TIMEOUT_MS = 8000;

export type ClaudeLoginStatus = 'yes' | 'no' | 'unknown';

export interface ClaudeCliStatus {
  readonly found: boolean;
  readonly path: string | null;
  readonly version: string | null;
  readonly loggedIn: ClaudeLoginStatus;
}

export interface CheckClaudeCliOptions {
  readonly claudeCliPath: string | null;
  readonly runner?: CommandRunner;
}

function parseLoggedIn(stdout: string): ClaudeLoginStatus {
  try {
    const parsed: unknown = JSON.parse(stdout);
    if (typeof parsed === 'object' && parsed !== null && typeof (parsed as { loggedIn?: unknown }).loggedIn === 'boolean') {
      return (parsed as { loggedIn: boolean }).loggedIn ? 'yes' : 'no';
    }
  } catch (error) {
    void error;
  }
  return 'unknown';
}

export async function checkClaudeCli(options: CheckClaudeCliOptions): Promise<ClaudeCliStatus> {
  const runner = options.runner ?? nodeCommandRunner;
  const path = options.claudeCliPath;

  if (path === null) {
    return { found: false, path: null, version: null, loggedIn: 'unknown' };
  }

  const versionResult = await runner.run(path, ['--version'], { timeoutMs: VERSION_TIMEOUT_MS });
  if (versionResult.timedOut || versionResult.exitCode !== 0) {
    return { found: false, path, version: null, loggedIn: 'unknown' };
  }
  const version = versionResult.stdout.trim();

  const authResult = await runner.run(path, ['auth', 'status'], { timeoutMs: AUTH_TIMEOUT_MS });
  const loggedIn =
    authResult.timedOut || authResult.exitCode !== 0 ? 'unknown' : parseLoggedIn(authResult.stdout);

  return { found: true, path, version, loggedIn };
}
