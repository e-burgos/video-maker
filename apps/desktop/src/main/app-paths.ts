import { join } from 'node:path';

export const MODELS_DIR_NAME = 'models';
export const PROJECTS_DIR_NAME = 'projects';
export const LOGS_DIR_NAME = 'logs';
export const DB_FILE_NAME = 'studio.db';
export const DEV_VENDOR_BIN_RELATIVE = 'apps/desktop/vendor/darwin-arm64/bin';
export const PACKAGED_VENDOR_BIN_RELATIVE = 'bin';
export const PACKAGED_REMOTION_BUNDLE_RELATIVE = 'remotion-bundle';
export const CHROME_HEADLESS_SHELL_RELATIVE = ['chrome-headless-shell', 'chrome-headless-shell'];

export interface AppPathsInput {
  readonly userDataDir: string;
  readonly isPackaged: boolean;
  readonly resourcesPath: string;
  readonly repoRoot: string;
}

export interface AppPaths {
  readonly userDataDir: string;
  readonly modelsDir: string;
  readonly defaultProjectsDir: string;
  readonly logsDir: string;
  readonly dbPath: string;
  readonly resourcesDir: string;
  readonly vendorBinDir: string;
  readonly remotionServeUrl: string | null;
  readonly chromeHeadlessShellPath: string;
}

export function resolveAppPaths(input: AppPathsInput): AppPaths {
  const resourcesDir = input.isPackaged ? input.resourcesPath : input.repoRoot;
  const vendorBinDir = input.isPackaged
    ? join(resourcesDir, PACKAGED_VENDOR_BIN_RELATIVE)
    : join(resourcesDir, DEV_VENDOR_BIN_RELATIVE);
  const modelsDir = join(input.userDataDir, MODELS_DIR_NAME);

  return {
    userDataDir: input.userDataDir,
    modelsDir,
    defaultProjectsDir: join(input.userDataDir, PROJECTS_DIR_NAME),
    logsDir: join(input.userDataDir, LOGS_DIR_NAME),
    dbPath: join(input.userDataDir, DB_FILE_NAME),
    resourcesDir,
    vendorBinDir,
    remotionServeUrl: input.isPackaged ? join(resourcesDir, PACKAGED_REMOTION_BUNDLE_RELATIVE) : null,
    chromeHeadlessShellPath: join(modelsDir, ...CHROME_HEADLESS_SHELL_RELATIVE),
  };
}

export function appDirectoriesToCreate(paths: AppPaths): readonly string[] {
  return [paths.modelsDir, paths.defaultProjectsDir, paths.logsDir];
}
