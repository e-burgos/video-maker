import { describe, expect, it, vi } from 'vitest';

const execaMock = vi.fn();

vi.mock('execa', () => ({ execa: execaMock }));

describe('ExecaCommandRunner env passthrough', () => {
  it('runs with the caller default env (no env option to execa) when none is configured', async () => {
    execaMock.mockResolvedValue({ stdout: 'ok', stderr: '', exitCode: 0 });
    const { ExecaCommandRunner } = await import('./execa-command-runner');

    const runner = new ExecaCommandRunner();
    await runner.run('ffmpeg', ['-version']);

    const options = execaMock.mock.calls[0]?.[2] as Record<string, unknown>;
    expect(options.env).toBeUndefined();
    expect(options.extendEnv).toBeUndefined();
  });

  it('pins the child to exactly the configured env, without extending it with process.env', async () => {
    execaMock.mockClear();
    execaMock.mockResolvedValue({ stdout: 'ok', stderr: '', exitCode: 0 });
    const { ExecaCommandRunner } = await import('./execa-command-runner');

    const minimalEnv = { HOME: '/Users/dev', PATH: '/usr/bin' };
    const runner = new ExecaCommandRunner({ env: minimalEnv });
    await runner.run('ffmpeg', ['-version']);

    const options = execaMock.mock.calls[0]?.[2] as Record<string, unknown>;
    expect(options.env).toBe(minimalEnv);
    expect(options.extendEnv).toBe(false);
  });
});
