import { describe, expect, it } from 'vitest';

import { buildStudioMcpLaunchCommand } from './studio-mcp-launch';

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
});
