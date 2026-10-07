import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { resolveHyperframesCli } from './hyperframes-cli';

const workspaceRoot = resolve(__dirname, '..', '..', '..', '..');

describe('resolveHyperframesCli', () => {
  it('resolves the installed hyperframes cli with the current node and the silencing env', () => {
    const invocation = resolveHyperframesCli({ PATH: '/bin', REMOTION_BROWSER_EXECUTABLE: '/chrome' }, workspaceRoot);
    expect(invocation.command).toBe(process.execPath);
    expect(invocation.args).toHaveLength(1);
    expect(existsSync(invocation.args[0] ?? '')).toBe(true);
    expect(invocation.env).toMatchObject({ HYPERFRAMES_NO_UPDATE_CHECK: '1', HYPERFRAMES_NO_TELEMETRY: '1', HYPERFRAMES_NO_AUTO_INSTALL: '1', PRODUCER_HEADLESS_SHELL_PATH: '/chrome' });
  });

  it('fails when hyperframes cannot be resolved from the given root', () => {
    expect(() => resolveHyperframesCli({}, '/nonexistent-root')).toThrow();
  });

  it('fails clearly when the installed hyperframes is not the pinned version', () => {
    const root = mkdtempSync(join(tmpdir(), 'hf-root-'));
    const pkg = join(root, 'node_modules', 'hyperframes');
    mkdirSync(join(pkg, 'dist'), { recursive: true });
    writeFileSync(join(root, 'package.json'), '{}');
    writeFileSync(join(pkg, 'package.json'), JSON.stringify({ name: 'hyperframes', version: '0.0.1' }));
    writeFileSync(join(pkg, 'dist', 'cli.js'), '');
    expect(() => resolveHyperframesCli({}, root)).toThrow('hyperframes 0.8.139 expected, found 0.0.1');
  });
});
