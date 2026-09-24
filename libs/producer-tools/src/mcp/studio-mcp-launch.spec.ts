import { describe, expect, it } from 'vitest';

import { buildStudioMcpLaunchCommand, STUDIO_API_TOKEN_ENV_VAR } from './studio-mcp-launch';

describe('buildStudioMcpLaunchCommand', () => {
  it('builds a node -r <register> <main> command with the CLI flags', () => {
    const launch = buildStudioMcpLaunchCommand({
      repoRoot: '/repo',
      apiUrl: 'http://127.0.0.1:4599',
      project: 'pitch-deck',
      model: 'sonnet',
      nodeExecutable: '/usr/bin/node',
    });

    expect(launch.command).toBe('/usr/bin/node');
    expect(launch.args).toEqual([
      '-r',
      '/repo/libs/producer-tools/src/mcp/mcp-register.cjs',
      '/repo/libs/producer-tools/src/mcp/main.ts',
      '--api-url',
      'http://127.0.0.1:4599',
      '--project',
      'pitch-deck',
      '--model',
      'sonnet',
    ]);
    expect(launch.env).toEqual({ SWC_NODE_PROJECT: '/repo/tsconfig.base.json' });
    expect(launch.cwd).toBe('/repo');
  });

  it('defaults nodeExecutable to the current process executable', () => {
    const launch = buildStudioMcpLaunchCommand({
      repoRoot: '/repo',
      apiUrl: 'http://127.0.0.1:4599',
      project: 'pitch-deck',
      model: 'sonnet',
    });

    expect(launch.command).toBe(process.execPath);
  });

  it('passes the access token as STUDIO_API_TOKEN in the dev command env', () => {
    const launch = buildStudioMcpLaunchCommand({
      repoRoot: '/repo',
      apiUrl: 'http://127.0.0.1:4599',
      project: 'pitch-deck',
      model: 'sonnet',
      accessToken: 'secret-token',
    });

    expect(launch.env[STUDIO_API_TOKEN_ENV_VAR]).toBe('secret-token');
  });

  it('with compiledEntryPath set, runs the compiled bundle directly with ELECTRON_RUN_AS_NODE=1 (US-017-202)', () => {
    const launch = buildStudioMcpLaunchCommand({
      repoRoot: '/repo',
      apiUrl: 'http://127.0.0.1:4599',
      project: 'pitch-deck',
      model: 'sonnet',
      nodeExecutable: '/app/Video Maker.app/Contents/MacOS/Video Maker',
      compiledEntryPath: '/app/resources/studio-mcp/main.js',
      accessToken: 'secret-token',
    });

    expect(launch.command).toBe('/app/Video Maker.app/Contents/MacOS/Video Maker');
    expect(launch.args).toEqual([
      '/app/resources/studio-mcp/main.js',
      '--api-url',
      'http://127.0.0.1:4599',
      '--project',
      'pitch-deck',
      '--model',
      'sonnet',
    ]);
    expect(launch.env).toEqual({ STUDIO_API_TOKEN: 'secret-token', ELECTRON_RUN_AS_NODE: '1' });
    expect(launch.cwd).toBe('/repo');
  });

  it('without compiledEntryPath, unset = today\'s dev command with -r and mcp-register.cjs', () => {
    const launch = buildStudioMcpLaunchCommand({
      repoRoot: '/repo',
      apiUrl: 'http://127.0.0.1:4599',
      project: 'pitch-deck',
      model: 'sonnet',
    });

    expect(launch.args[0]).toBe('-r');
    expect(launch.env.ELECTRON_RUN_AS_NODE).toBeUndefined();
  });
});
