import { describe, expect, it, vi } from 'vitest';

import type { AppPaths } from './app-paths';
import { allowlistedParentEnv, buildRenderApiEnv } from './render-api-env';

const PATHS: AppPaths = {
  userDataDir: '/user-data',
  modelsDir: '/user-data/models',
  defaultProjectsDir: '/user-data/projects',
  logsDir: '/user-data/logs',
  dbPath: '/user-data/studio.db',
  resourcesDir: '/resources',
  vendorBinDir: '/resources/bin',
  remotionServeUrl: null,
  chromeHeadlessShellPath: '/user-data/models/chrome-headless-shell/chrome-headless-shell',
};

describe('allowlistedParentEnv', () => {
  it('keeps only the identity and locale variables the child needs', () => {
    const source: NodeJS.ProcessEnv = {
      HOME: '/Users/dev',
      USER: 'dev',
      LOGNAME: 'dev',
      TMPDIR: '/tmp',
      SHELL: '/bin/zsh',
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US.UTF-8',
      LC_CTYPE: 'en_US.UTF-8',
      PATH: '/usr/bin:/bin',
      SECRET_TOKEN: 'do-not-leak',
      ANTHROPIC_API_KEY: 'do-not-leak-either',
      npm_config_registry: 'https://registry.npmjs.org',
    };

    expect(allowlistedParentEnv(source)).toEqual({
      HOME: '/Users/dev',
      USER: 'dev',
      LOGNAME: 'dev',
      TMPDIR: '/tmp',
      SHELL: '/bin/zsh',
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US.UTF-8',
      LC_CTYPE: 'en_US.UTF-8',
    });
  });

  it('omits keys that are simply absent, without inserting undefined', () => {
    expect(allowlistedParentEnv({ HOME: '/Users/dev' })).toEqual({ HOME: '/Users/dev' });
  });
});

describe('buildRenderApiEnv', () => {
  it('never spreads the parent env: only the allowlist plus the explicit vars it sets survive', async () => {
    const env = await buildRenderApiEnv(
      {
        paths: PATHS,
        host: '127.0.0.1',
        port: 4310,
        token: 'sekret-token',
        projectsFolder: '/user-data/projects',
        isPackaged: false,
        parentPid: 4242,
        parentEnv: {
          HOME: '/Users/dev',
          PATH: '/usr/bin:/bin',
          SECRET_TOKEN: 'do-not-leak',
          npm_config_registry: 'https://registry.npmjs.org',
        },
      },
      {
        readLoginShellPath: vi.fn().mockResolvedValue('/opt/homebrew/bin:/usr/local/bin'),
        resolveClaudeCli: vi.fn().mockResolvedValue('/opt/homebrew/bin/claude'),
      },
    );

    expect(env.SECRET_TOKEN).toBeUndefined();
    expect(env['npm_config_registry']).toBeUndefined();
    expect(env.HOME).toBe('/Users/dev');
    expect(env.PATH).toContain('/opt/homebrew/bin');
    expect(env.RENDER_API_HOST).toBe('127.0.0.1');
    expect(env.RENDER_API_PORT).toBe('4310');
    expect(env.RENDER_API_MEDIA_ROOT).toBe('/user-data/projects');
    expect(env.BRANDS_ROOT).toBe('/user-data/brands');
    expect(env.RENDER_API_ACCESS_TOKEN).toBe('sekret-token');
    expect(env.VIDEO_MAKER_PARENT_PID).toBe('4242');
    expect(env.VIDEO_MAKER_BIN_DIR).toBe('/resources/bin');
    expect(env.VIDEO_MAKER_MODELS_DIR).toBe('/user-data/models');
    expect(env.REMOTION_BROWSER_EXECUTABLE).toBe(PATHS.chromeHeadlessShellPath);
    expect(env.CLAUDE_CLI_PATH).toBe('/opt/homebrew/bin/claude');
  });

  it('adds the web root and MCP entry only when packaged', async () => {
    const deps = {
      readLoginShellPath: vi.fn().mockResolvedValue(null),
      resolveClaudeCli: vi.fn().mockResolvedValue(null),
    };

    const unpackaged = await buildRenderApiEnv(
      { paths: PATHS, host: '127.0.0.1', port: 4310, token: 't', projectsFolder: '/p', isPackaged: false, parentPid: 1 },
      deps,
    );
    expect(unpackaged.RENDER_API_WEB_ROOT).toBeUndefined();
    expect(unpackaged.STUDIO_MCP_ENTRY).toBeUndefined();

    const packaged = await buildRenderApiEnv(
      { paths: PATHS, host: '127.0.0.1', port: 4310, token: 't', projectsFolder: '/p', isPackaged: true, parentPid: 1 },
      deps,
    );
    expect(packaged.RENDER_API_WEB_ROOT).toBe('/resources/web');
    expect(packaged.STUDIO_MCP_ENTRY).toBe('/resources/mcp/main.js');
  });

  it('points render-api at the motion assets and the bundled HyperFrames, with the vendored ffmpeg first on PATH', async () => {
    const deps = { readLoginShellPath: vi.fn().mockResolvedValue(null), resolveClaudeCli: vi.fn().mockResolvedValue(null) };
    const build = (isPackaged: boolean) =>
      buildRenderApiEnv({ paths: PATHS, host: '127.0.0.1', port: 4310, token: 't', projectsFolder: '/p', isPackaged, parentPid: 1 }, deps);
    const packaged = await build(true);
    expect(packaged.MOTION_GRAPHICS_ASSETS).toBe('/resources/motion-assets');
    expect(packaged.HYPERFRAMES_RESOLVE_FROM).toBe('/resources/render-api');
    expect(packaged.PATH?.split(':')[0]).toBe('/resources/bin');
    const unpackaged = await build(false);
    expect(unpackaged.MOTION_GRAPHICS_ASSETS).toBe('/resources/libs/motion-graphics/assets');
    expect(unpackaged.HYPERFRAMES_RESOLVE_FROM).toBeUndefined();
  });

  it('sets REMOTION_SERVE_URL only when the paths carry one', async () => {
    const deps = {
      readLoginShellPath: vi.fn().mockResolvedValue(null),
      resolveClaudeCli: vi.fn().mockResolvedValue(null),
    };

    const withServeUrl = await buildRenderApiEnv(
      {
        paths: { ...PATHS, remotionServeUrl: '/resources/remotion-bundle' },
        host: '127.0.0.1',
        port: 4310,
        token: 't',
        projectsFolder: '/p',
        isPackaged: true,
        parentPid: 1,
      },
      deps,
    );
    expect(withServeUrl.REMOTION_SERVE_URL).toBe('/resources/remotion-bundle');
  });

  it('omits CLAUDE_CLI_PATH when the CLI cannot be resolved', async () => {
    const env = await buildRenderApiEnv(
      { paths: PATHS, host: '127.0.0.1', port: 4310, token: 't', projectsFolder: '/p', isPackaged: false, parentPid: 1 },
      { readLoginShellPath: vi.fn().mockResolvedValue(null), resolveClaudeCli: vi.fn().mockResolvedValue(null) },
    );

    expect(env.CLAUDE_CLI_PATH).toBeUndefined();
  });
});
