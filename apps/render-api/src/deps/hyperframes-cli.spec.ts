import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { resolveHyperframesCli } from './hyperframes-cli';

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

describe('resolveHyperframesCli', () => {
  it('runs the installed cli with the current node and the hyperframes flags', () => {
    const invocation = resolveHyperframesCli({ env: { PATH: '/bin' }, execPath: '/usr/bin/node', isElectron: false, resolveFrom: REPO_ROOT });

    expect(invocation.command).toBe('/usr/bin/node');
    expect(invocation.args[0]).toContain(join('hyperframes', 'dist', 'cli.js'));
    expect(invocation.env).toMatchObject({
      PATH: '/bin',
      HYPERFRAMES_NO_UPDATE_CHECK: '1',
      HYPERFRAMES_NO_TELEMETRY: '1',
      HYPERFRAMES_NO_AUTO_INSTALL: '1',
    });
    expect(invocation.env).not.toHaveProperty('ELECTRON_RUN_AS_NODE');
  });

  it('sets ELECTRON_RUN_AS_NODE under electron and forwards the browser path', () => {
    const invocation = resolveHyperframesCli({
      env: { REMOTION_BROWSER_EXECUTABLE: '/opt/chrome' },
      execPath: '/Applications/App',
      isElectron: true,
      resolveFrom: REPO_ROOT,
    });

    expect(invocation.env).toMatchObject({ ELECTRON_RUN_AS_NODE: '1', PRODUCER_HEADLESS_SHELL_PATH: '/opt/chrome' });
  });

  it('resolves from HYPERFRAMES_RESOLVE_FROM when no explicit root is given', () => {
    const invocation = resolveHyperframesCli({
      env: { HYPERFRAMES_RESOLVE_FROM: REPO_ROOT },
      execPath: 'node',
      isElectron: false,
    });

    expect(invocation.args[0]).toContain('hyperframes');
  });

  it('fails when the cli cannot be resolved', () => {
    expect(() => resolveHyperframesCli({ env: {}, execPath: 'node', isElectron: false, resolveFrom: '/nonexistent-root' })).toThrow();
  });
});
