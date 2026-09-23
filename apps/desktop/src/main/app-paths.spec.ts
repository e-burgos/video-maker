import { describe, expect, it } from 'vitest';

import { appDirectoriesToCreate, resolveAppPaths } from './app-paths';

describe('resolveAppPaths', () => {
  it('resolves the vendor bin dir and resources dir from the repo root in dev mode', () => {
    const paths = resolveAppPaths({
      userDataDir: '/Users/friend/Library/Application Support/Video Maker',
      isPackaged: false,
      resourcesPath: '/should/be/ignored',
      repoRoot: '/repo',
    });

    expect(paths.resourcesDir).toBe('/repo');
    expect(paths.vendorBinDir).toBe('/repo/apps/desktop/vendor/darwin-arm64/bin');
    expect(paths.remotionServeUrl).toBeNull();
  });

  it('resolves the vendor bin dir and remotion bundle from the packaged resources dir', () => {
    const paths = resolveAppPaths({
      userDataDir: '/Users/friend/Library/Application Support/Video Maker',
      isPackaged: true,
      resourcesPath: '/Applications/Video Maker.app/Contents/Resources',
      repoRoot: '/should/be/ignored',
    });

    expect(paths.resourcesDir).toBe('/Applications/Video Maker.app/Contents/Resources');
    expect(paths.vendorBinDir).toBe('/Applications/Video Maker.app/Contents/Resources/bin');
    expect(paths.remotionServeUrl).toBe('/Applications/Video Maker.app/Contents/Resources/remotion-bundle');
  });

  it('places models, projects and logs under the user data directory', () => {
    const paths = resolveAppPaths({
      userDataDir: '/Users/friend/Library/Application Support/Video Maker',
      isPackaged: true,
      resourcesPath: '/Applications/Video Maker.app/Contents/Resources',
      repoRoot: '/repo',
    });

    expect(paths.modelsDir).toBe('/Users/friend/Library/Application Support/Video Maker/models');
    expect(paths.defaultProjectsDir).toBe('/Users/friend/Library/Application Support/Video Maker/projects');
    expect(paths.logsDir).toBe('/Users/friend/Library/Application Support/Video Maker/logs');
    expect(paths.dbPath).toBe('/Users/friend/Library/Application Support/Video Maker/studio.db');
    expect(paths.chromeHeadlessShellPath).toBe(
      '/Users/friend/Library/Application Support/Video Maker/models/chrome-headless-shell/chrome-headless-shell',
    );
  });

  it('lists exactly the directories that need to exist on first run', () => {
    const paths = resolveAppPaths({
      userDataDir: '/Users/friend/data',
      isPackaged: true,
      resourcesPath: '/res',
      repoRoot: '/repo',
    });

    expect(appDirectoriesToCreate(paths)).toEqual([
      '/Users/friend/data/models',
      '/Users/friend/data/projects',
      '/Users/friend/data/logs',
    ]);
  });
});
