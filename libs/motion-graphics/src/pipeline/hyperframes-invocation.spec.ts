import { describe, expect, it } from 'vitest';

import { hyperframesInvocation } from './hyperframes-invocation';
import type { HyperframesInvocationInput } from './hyperframes-invocation';

const base: HyperframesInvocationInput = { cliPath: '/nm/hyperframes/dist/cli.js', execPath: '/usr/bin/node', isElectron: false, env: { PATH: '/bin', EMPTY: undefined } };

describe('hyperframesInvocation', () => {
  it('runs the installed cli with the exec path and silences update, telemetry and auto install', () => {
    const invocation = hyperframesInvocation(base);
    expect(invocation.command).toBe('/usr/bin/node');
    expect(invocation.args).toEqual(['/nm/hyperframes/dist/cli.js']);
    expect(invocation.env).toEqual({ PATH: '/bin', HYPERFRAMES_NO_UPDATE_CHECK: '1', HYPERFRAMES_NO_TELEMETRY: '1', HYPERFRAMES_NO_AUTO_INSTALL: '1' });
  });

  it('runs electron as node only under electron', () => {
    expect(hyperframesInvocation({ ...base, isElectron: true }).env['ELECTRON_RUN_AS_NODE']).toBe('1');
    expect(hyperframesInvocation(base).env['ELECTRON_RUN_AS_NODE']).toBeUndefined();
  });

  it('points the producer at the configured browser', () => {
    const withBrowser = hyperframesInvocation({ ...base, env: { REMOTION_BROWSER_EXECUTABLE: '/chrome' } });
    expect(withBrowser.env['PRODUCER_HEADLESS_SHELL_PATH']).toBe('/chrome');
    expect(hyperframesInvocation({ ...base, env: { REMOTION_BROWSER_EXECUTABLE: '' } }).env['PRODUCER_HEADLESS_SHELL_PATH']).toBeUndefined();
  });
});
