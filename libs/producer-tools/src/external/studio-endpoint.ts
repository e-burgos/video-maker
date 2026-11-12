import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { STUDIO_TOKEN_HEADER } from '../client/http-render-api-client';

export const VIDEO_MAKER_API_URL_ENV_VAR = 'VIDEO_MAKER_API_URL';
export const VIDEO_MAKER_API_TOKEN_ENV_VAR = 'VIDEO_MAKER_API_TOKEN';
export const VIDEO_MAKER_HOME_ENV_VAR = 'VIDEO_MAKER_HOME';
export const DISCOVERY_SOURCES_IN_PREFERENCE_ORDER = ['desktop', 'dev'] as const;
export const NO_STUDIO_FOUND_MESSAGE =
  'No Video Maker studio was found. Open the Video Maker app (it keeps a studio running while it is open) or run `pnpm studio` in the video-maker repository, then call the tool again. To use a studio somewhere else, set VIDEO_MAKER_API_URL (and VIDEO_MAKER_API_TOKEN).';
const HEALTH_TIMEOUT_MS = 5000;

export type StudioEndpointSource = 'argument' | 'environment' | (typeof DISCOVERY_SOURCES_IN_PREFERENCE_ORDER)[number];

export interface StudioEndpoint {
  readonly apiUrl: string;
  readonly accessToken?: string;
  readonly source: StudioEndpointSource;
}

export interface ResolveStudioEndpointInput {
  readonly apiUrlArgument: string | null;
  readonly env: NodeJS.ProcessEnv;
  readonly fetchImpl?: typeof fetch;
  readonly isProcessAlive?: (pid: number) => boolean;
}

export class StudioNotFoundError extends Error {
  constructor(message: string = NO_STUDIO_FOUND_MESSAGE) {
    super(message);
    this.name = 'StudioNotFoundError';
  }
}

function nonEmpty(value: string | undefined): string | undefined {
  return value === undefined || value === '' ? undefined : value;
}

function trimTrailingSlash(apiUrl: string): string {
  return apiUrl.replace(/\/$/u, '');
}

function videoMakerHome(env: NodeJS.ProcessEnv): string {
  return nonEmpty(env[VIDEO_MAKER_HOME_ENV_VAR]) ?? join(homedir(), '.video-maker');
}

function defaultIsProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (cause) {
    return (cause as NodeJS.ErrnoException).code === 'EPERM';
  }
}

export async function probeStudioHealth(
  apiUrl: string,
  accessToken: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<Readonly<Record<string, unknown>> | null> {
  try {
    const response = await fetchImpl(`${trimTrailingSlash(apiUrl)}/health`, {
      ...(accessToken === undefined ? {} : { headers: { [STUDIO_TOKEN_HEADER]: accessToken } }),
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    if (!response.ok) {
      return null;
    }
    const body: unknown = await response.json();
    return typeof body === 'object' && body !== null && (body as { service?: unknown }).service === 'render-api'
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

interface DiscoveryRecord {
  readonly apiUrl: string;
  readonly token: string | null;
  readonly pid: number;
}

async function readDiscoveryRecord(home: string, source: string): Promise<DiscoveryRecord | null> {
  try {
    const parsed: unknown = JSON.parse(await readFile(join(home, `studio.${source}.json`), 'utf8'));
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    const { apiUrl, token, pid } = parsed as Record<string, unknown>;
    if (typeof apiUrl !== 'string' || typeof pid !== 'number') {
      return null;
    }
    return { apiUrl, token: typeof token === 'string' ? token : null, pid };
  } catch {
    return null;
  }
}

export async function resolveStudioEndpoint(input: ResolveStudioEndpointInput): Promise<StudioEndpoint> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const isProcessAlive = input.isProcessAlive ?? defaultIsProcessAlive;

  if (input.apiUrlArgument !== null) {
    const accessToken = nonEmpty(input.env.STUDIO_API_TOKEN);
    return { apiUrl: trimTrailingSlash(input.apiUrlArgument), ...(accessToken === undefined ? {} : { accessToken }), source: 'argument' };
  }

  const forcedUrl = nonEmpty(input.env[VIDEO_MAKER_API_URL_ENV_VAR]);
  if (forcedUrl !== undefined) {
    const accessToken = nonEmpty(input.env[VIDEO_MAKER_API_TOKEN_ENV_VAR]);
    if ((await probeStudioHealth(forcedUrl, accessToken, fetchImpl)) === null) {
      throw new StudioNotFoundError(
        `${VIDEO_MAKER_API_URL_ENV_VAR} points at ${trimTrailingSlash(forcedUrl)} but no Video Maker studio answers there (check the URL and ${VIDEO_MAKER_API_TOKEN_ENV_VAR}). ${NO_STUDIO_FOUND_MESSAGE}`,
      );
    }
    return { apiUrl: trimTrailingSlash(forcedUrl), ...(accessToken === undefined ? {} : { accessToken }), source: 'environment' };
  }

  const home = videoMakerHome(input.env);
  for (const source of DISCOVERY_SOURCES_IN_PREFERENCE_ORDER) {
    const record = await readDiscoveryRecord(home, source);
    if (record === null || !isProcessAlive(record.pid)) {
      continue;
    }
    const accessToken = record.token ?? undefined;
    if ((await probeStudioHealth(record.apiUrl, accessToken, fetchImpl)) !== null) {
      return { apiUrl: trimTrailingSlash(record.apiUrl), ...(accessToken === undefined ? {} : { accessToken }), source };
    }
  }

  throw new StudioNotFoundError();
}
