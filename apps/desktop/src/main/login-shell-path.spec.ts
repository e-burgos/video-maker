import { describe, expect, it, vi } from 'vitest';

import type { CommandResult, CommandRunner, ExecutableLookup } from './login-shell-path';
import {
  mergePathWithDefault,
  nodeCommandRunner,
  nodeExecutableLookup,
  readLoginShellPath,
  resolveClaudeCli,
} from './login-shell-path';

function fakeRunner(result: CommandResult): CommandRunner {
  return { run: vi.fn().mockResolvedValue(result) };
}

describe('readLoginShellPath', () => {
  it('extracts the PATH between markers, ignoring rc noise printed before it', async () => {
    const runner = fakeRunner({
      stdout: 'Welcome to zsh!\nsome plugin banner\n__video_maker_login_path_start__/opt/homebrew/bin:/usr/bin__video_maker_login_path_end__trailing noise',
      exitCode: 0,
      timedOut: false,
    });

    const path = await readLoginShellPath({ runner, env: { SHELL: '/bin/zsh' } });

    expect(path).toBe('/opt/homebrew/bin:/usr/bin');
  });

  it('returns null when the shell times out', async () => {
    const runner = fakeRunner({ stdout: '', exitCode: null, timedOut: true });
    const path = await readLoginShellPath({ runner });
    expect(path).toBeNull();
  });

  it('returns null when the shell exits non-zero', async () => {
    const runner = fakeRunner({ stdout: '', exitCode: 1, timedOut: false });
    const path = await readLoginShellPath({ runner });
    expect(path).toBeNull();
  });

  it('returns null when the markers are missing from stdout', async () => {
    const runner = fakeRunner({ stdout: 'no markers here', exitCode: 0, timedOut: false });
    const path = await readLoginShellPath({ runner });
    expect(path).toBeNull();
  });

  it('falls back to /bin/zsh when SHELL is unset', async () => {
    const runner = fakeRunner({
      stdout: '__video_maker_login_path_start__/usr/bin__video_maker_login_path_end__',
      exitCode: 0,
      timedOut: false,
    });

    await readLoginShellPath({ runner, env: {} });

    expect(runner.run).toHaveBeenCalledWith('/bin/zsh', expect.anything(), expect.anything());
  });
});

describe('mergePathWithDefault', () => {
  it('puts the login shell directories first and drops duplicates', () => {
    const merged = mergePathWithDefault('/opt/homebrew/bin:/usr/bin', '/usr/bin:/bin');
    expect(merged).toBe('/opt/homebrew/bin:/usr/bin:/bin');
  });

  it('returns the current PATH unchanged when the login shell PATH is null', () => {
    expect(mergePathWithDefault(null, '/usr/bin:/bin')).toBe('/usr/bin:/bin');
  });
});

describe('resolveClaudeCli', () => {
  it('prefers CLAUDE_CLI_PATH when it points at an executable file', async () => {
    const lookup: ExecutableLookup = { isExecutableFile: vi.fn().mockResolvedValue(true) };
    const path = await resolveClaudeCli({ env: { CLAUDE_CLI_PATH: '/custom/claude' }, lookup });
    expect(path).toBe('/custom/claude');
  });

  it('falls back to the login shell PATH when CLAUDE_CLI_PATH is unset', async () => {
    const seen: string[] = [];
    const lookup: ExecutableLookup = {
      isExecutableFile: vi.fn(async (path: string) => {
        seen.push(path);
        return path === '/opt/homebrew/bin/claude';
      }),
    };

    const path = await resolveClaudeCli({
      env: {},
      lookup,
      loginShellPath: '/opt/homebrew/bin:/usr/bin',
    });

    expect(path).toBe('/opt/homebrew/bin/claude');
    expect(seen).toContain('/opt/homebrew/bin/claude');
  });

  it('falls back to known install locations when PATH lookup fails', async () => {
    const lookup: ExecutableLookup = {
      isExecutableFile: vi.fn(async (path: string) => path === '/Users/friend/.local/bin/claude'),
    };

    const path = await resolveClaudeCli({
      env: {},
      lookup,
      loginShellPath: '/usr/bin',
      homeDir: '/Users/friend',
    });

    expect(path).toBe('/Users/friend/.local/bin/claude');
  });

  it('returns null when the CLI cannot be found anywhere', async () => {
    const lookup: ExecutableLookup = { isExecutableFile: vi.fn().mockResolvedValue(false) };
    const path = await resolveClaudeCli({ env: {}, lookup, loginShellPath: '/usr/bin', homeDir: '/Users/friend' });
    expect(path).toBeNull();
  });
});

describe('nodeCommandRunner (real process)', () => {
  it('runs a real command and captures its stdout', async () => {
    const result = await nodeCommandRunner.run('/bin/sh', ['-c', 'printf hello'], { timeoutMs: 5000 });
    expect(result).toEqual({ stdout: 'hello', exitCode: 0, timedOut: false });
  });

  it('kills the command and reports timedOut once the timeout elapses', async () => {
    const result = await nodeCommandRunner.run('/bin/sh', ['-c', 'sleep 5'], { timeoutMs: 50 });
    expect(result.timedOut).toBe(true);
  });

  it('reports a non-zero exit code', async () => {
    const result = await nodeCommandRunner.run('/bin/sh', ['-c', 'exit 3'], { timeoutMs: 5000 });
    expect(result.exitCode).toBe(3);
  });
});

describe('nodeExecutableLookup (real filesystem)', () => {
  it('returns true for a real executable file', async () => {
    expect(await nodeExecutableLookup.isExecutableFile('/bin/ls')).toBe(true);
  });

  it('returns false for a path that does not exist', async () => {
    expect(await nodeExecutableLookup.isExecutableFile('/no/such/binary')).toBe(false);
  });
});
