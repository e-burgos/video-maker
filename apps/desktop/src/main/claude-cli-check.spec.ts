import { describe, expect, it, vi } from 'vitest';

import type { CommandResult, CommandRunner } from './login-shell-path';
import { checkClaudeCli } from './claude-cli-check';

function fakeRunner(byArgs: (args: readonly string[]) => CommandResult): CommandRunner {
  return { run: vi.fn(async (_cmd: string, args: readonly string[]) => byArgs(args)) };
}

describe('checkClaudeCli', () => {
  it('reports not found when no path was resolved', async () => {
    const status = await checkClaudeCli({ claudeCliPath: null });
    expect(status).toEqual({ found: false, path: null, version: null, loggedIn: 'unknown' });
  });

  it('reports found, the version and logged-in status from a real-shaped auth JSON', async () => {
    const runner = fakeRunner((args) => {
      if (args[0] === '--version') {
        return { stdout: '2.1.123 (Claude Code)\n', exitCode: 0, timedOut: false };
      }
      return { stdout: JSON.stringify({ loggedIn: true, authMethod: 'claude.ai' }), exitCode: 0, timedOut: false };
    });

    const status = await checkClaudeCli({ claudeCliPath: '/opt/homebrew/bin/claude', runner });

    expect(status).toEqual({
      found: true,
      path: '/opt/homebrew/bin/claude',
      version: '2.1.123 (Claude Code)',
      loggedIn: 'yes',
    });
  });

  it('reports loggedIn "no" when the auth JSON says so', async () => {
    const runner = fakeRunner((args) =>
      args[0] === '--version'
        ? { stdout: '2.1.123', exitCode: 0, timedOut: false }
        : { stdout: JSON.stringify({ loggedIn: false }), exitCode: 0, timedOut: false },
    );

    const status = await checkClaudeCli({ claudeCliPath: '/opt/homebrew/bin/claude', runner });
    expect(status.loggedIn).toBe('no');
  });

  it('reports not found when --version times out or fails', async () => {
    const runner = fakeRunner(() => ({ stdout: '', exitCode: 1, timedOut: false }));
    const status = await checkClaudeCli({ claudeCliPath: '/opt/homebrew/bin/claude', runner });
    expect(status.found).toBe(false);
    expect(status.version).toBeNull();
  });

  it('reports loggedIn "unknown" when there is no non-interactive auth check available', async () => {
    const runner = fakeRunner((args) =>
      args[0] === '--version'
        ? { stdout: '2.1.123', exitCode: 0, timedOut: false }
        : { stdout: 'error: unknown command', exitCode: 1, timedOut: false },
    );

    const status = await checkClaudeCli({ claudeCliPath: '/opt/homebrew/bin/claude', runner });
    expect(status.found).toBe(true);
    expect(status.version).toBe('2.1.123');
    expect(status.loggedIn).toBe('unknown');
  });

  it('reports loggedIn "unknown" when the auth probe times out', async () => {
    const runner = fakeRunner((args) =>
      args[0] === '--version'
        ? { stdout: '2.1.123', exitCode: 0, timedOut: false }
        : { stdout: '', exitCode: null, timedOut: true },
    );

    const status = await checkClaudeCli({ claudeCliPath: '/opt/homebrew/bin/claude', runner });
    expect(status.loggedIn).toBe('unknown');
  });

  it('reports loggedIn "unknown" when the auth output is not the expected JSON shape', async () => {
    const runner = fakeRunner((args) =>
      args[0] === '--version'
        ? { stdout: '2.1.123', exitCode: 0, timedOut: false }
        : { stdout: 'not json at all', exitCode: 0, timedOut: false },
    );

    const status = await checkClaudeCli({ claudeCliPath: '/opt/homebrew/bin/claude', runner });
    expect(status.loggedIn).toBe('unknown');
  });
});
