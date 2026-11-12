import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const VIDEO_MAKER_HOME_ENV_VAR = 'VIDEO_MAKER_HOME';
export const STUDIO_SOURCE_ENV_VAR = 'VIDEO_MAKER_STUDIO_SOURCE';
export const APP_VERSION_ENV_VAR = 'VIDEO_MAKER_APP_VERSION';
export const DEFAULT_APP_VERSION = '0.0.0-dev';

export const STUDIO_SOURCES = ['desktop', 'dev'] as const;
export type StudioSource = (typeof STUDIO_SOURCES)[number];

const HOME_DIRECTORY_NAME = '.video-maker';
const HOME_DIRECTORY_MODE = 0o700;
const DISCOVERY_FILE_MODE = 0o600;

export interface StudioDiscoveryRecord {
  readonly apiUrl: string;
  readonly token: string | null;
  readonly version: string;
  readonly source: StudioSource;
  readonly pid: number;
  readonly startedAt: string;
}

export function resolveVideoMakerHome(env: NodeJS.ProcessEnv): string {
  const override = env[VIDEO_MAKER_HOME_ENV_VAR];
  return override === undefined || override === '' ? join(homedir(), HOME_DIRECTORY_NAME) : override;
}

export function studioDiscoveryFileName(source: StudioSource): string {
  return `studio.${source}.json`;
}

export function resolveStudioSource(env: NodeJS.ProcessEnv): StudioSource {
  return env[STUDIO_SOURCE_ENV_VAR] === 'desktop' ? 'desktop' : 'dev';
}

export function resolveAppVersion(env: NodeJS.ProcessEnv): string {
  const value = env[APP_VERSION_ENV_VAR];
  return value === undefined || value === '' ? DEFAULT_APP_VERSION : value;
}

export async function writeStudioDiscoveryFile(home: string, record: StudioDiscoveryRecord): Promise<string> {
  await mkdir(home, { recursive: true, mode: HOME_DIRECTORY_MODE });
  await chmod(home, HOME_DIRECTORY_MODE);
  const target = join(home, studioDiscoveryFileName(record.source));
  const staging = `${target}.${String(record.pid)}.tmp`;
  await writeFile(staging, `${JSON.stringify(record, null, 2)}\n`, { mode: DISCOVERY_FILE_MODE });
  await chmod(staging, DISCOVERY_FILE_MODE);
  await rename(staging, target);
  return target;
}

export async function removeStudioDiscoveryFileIfOwned(home: string, source: StudioSource, pid: number): Promise<boolean> {
  const target = join(home, studioDiscoveryFileName(source));
  let owner: unknown;
  try {
    owner = (JSON.parse(await readFile(target, 'utf8')) as { pid?: unknown }).pid;
  } catch {
    return false;
  }
  if (owner !== pid) {
    return false;
  }
  await rm(target, { force: true });
  return true;
}
