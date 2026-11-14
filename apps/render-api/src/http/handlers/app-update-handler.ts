import { isNewerVersion } from '../../app-update/compare-versions';
import { resolveAppVersion } from '../../discovery/studio-discovery-file';
import { JSON_CONTENT_TYPE } from '../http-message';
import type { HttpResponse } from '../http-message';

export const UPDATE_MANIFEST_URL_ENV_VAR = 'VIDEO_MAKER_UPDATE_MANIFEST_URL';
export const DEFAULT_UPDATE_MANIFEST_URL = 'https://video.estebanburgos.com.ar/descargas/latest.json';
export const UPDATE_FETCH_TIMEOUT_MS = 4000;

export type AppUpdateStatus = 'up-to-date' | 'available' | 'unknown';

export interface AppUpdateBody {
  readonly status: AppUpdateStatus;
  readonly installedVersion: string;
  readonly latestVersion?: string;
  readonly downloadUrl?: string;
  readonly publishedAt?: string;
}

export interface AppUpdateDependencies {
  readonly env: NodeJS.ProcessEnv;
  readonly fetchManifest: (url: string, timeoutMs: number) => Promise<unknown>;
}

interface UpdateManifest {
  readonly version: string;
  readonly url: string;
  readonly publishedAt?: string;
}

export async function fetchManifestJson(url: string, timeoutMs: number): Promise<unknown> {
  const response = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`manifest responded ${String(response.status)}`);
  }
  return await response.json();
}

function parseManifest(raw: unknown): UpdateManifest | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  if (typeof record.version !== 'string' || typeof record.url !== 'string') {
    return null;
  }
  const publishedAt = typeof record.publishedAt === 'string' ? record.publishedAt : undefined;
  return { version: record.version, url: record.url, ...(publishedAt === undefined ? {} : { publishedAt }) };
}

function resolveManifestUrl(env: NodeJS.ProcessEnv): string {
  const override = env[UPDATE_MANIFEST_URL_ENV_VAR];
  return override === undefined || override === '' ? DEFAULT_UPDATE_MANIFEST_URL : override;
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function toBody(installedVersion: string, manifest: UpdateManifest | null): AppUpdateBody {
  if (manifest === null || !isHttpUrl(manifest.url)) {
    return { status: 'unknown', installedVersion };
  }
  const newer = isNewerVersion(manifest.version, installedVersion);
  if (newer === null) {
    return { status: 'unknown', installedVersion };
  }
  const published = manifest.publishedAt === undefined ? {} : { publishedAt: manifest.publishedAt };
  if (newer) {
    return {
      status: 'available',
      installedVersion,
      latestVersion: manifest.version,
      downloadUrl: manifest.url,
      ...published,
    };
  }
  return { status: 'up-to-date', installedVersion, latestVersion: manifest.version, ...published };
}

export async function handleGetAppUpdate(
  dependencies: AppUpdateDependencies = { env: process.env, fetchManifest: fetchManifestJson },
): Promise<HttpResponse> {
  const installedVersion = resolveAppVersion(dependencies.env);
  let manifest: UpdateManifest | null = null;
  try {
    manifest = parseManifest(
      await dependencies.fetchManifest(resolveManifestUrl(dependencies.env), UPDATE_FETCH_TIMEOUT_MS),
    );
  } catch {
    manifest = null;
  }
  return {
    status: 200,
    headers: { 'content-type': JSON_CONTENT_TYPE, 'cache-control': 'no-store' },
    body: toBody(installedVersion, manifest),
  };
}
