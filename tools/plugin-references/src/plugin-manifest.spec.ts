import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const WORKSPACE_ROOT = join(__dirname, '..', '..', '..');
const PLUGIN_DIR = join(WORKSPACE_ROOT, 'plugins', 'video-maker');

interface MarketplaceEntry {
  readonly name: string;
  readonly source: string;
  readonly version?: string;
}

function readJson<T>(...segments: string[]): T {
  return JSON.parse(readFileSync(join(WORKSPACE_ROOT, ...segments), 'utf8')) as T;
}

const npmPackage = readJson<{ name: string; version: string }>('libs', 'producer-tools', 'npm', 'package.json');
const pluginManifest = readJson<{ name: string; version: string }>('plugins', 'video-maker', '.claude-plugin', 'plugin.json');
const marketplace = readJson<{ name: string; plugins: MarketplaceEntry[] }>('.claude-plugin', 'marketplace.json');
const mcpConfig = JSON.parse(readFileSync(join(PLUGIN_DIR, '.mcp.json'), 'utf8')) as {
  mcpServers: Record<string, { command: string; args: string[] }>;
};

describe('video-maker plugin packaging', () => {
  it('ships the same version as the MCP npm package', () => {
    expect(pluginManifest.version).toBe(npmPackage.version);
  });

  it('is listed once in the marketplace with the plugin folder as source and the same version', () => {
    const entries = marketplace.plugins.filter((entry) => entry.name === pluginManifest.name);
    expect(marketplace.name).toBe('video-maker');
    expect(entries).toHaveLength(1);
    expect(entries[0]?.source).toBe('./plugins/video-maker');
    expect(entries[0]?.version ?? pluginManifest.version).toBe(npmPackage.version);
  });

  it('launches the published MCP package with npx', () => {
    const server = mcpConfig.mcpServers['video-maker'];
    expect(server?.command).toBe('npx');
    expect(server?.args.join(' ')).toContain(npmPackage.name);
  });
});
