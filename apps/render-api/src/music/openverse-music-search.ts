import type { FetchRemotePort } from '../deps/render-api-dependencies';
import { collectBytes, isFreeCommercialLicense, stableResultId } from '../media-search/commons-shared';
import { isPortableFileName } from '../store/asset-path';
import type { FreeMusicResult } from './brand-music-bank';
import { COMMONS_USER_AGENT, MAX_COMMONS_MUSIC_DURATION_SEC, MIN_COMMONS_MUSIC_DURATION_SEC } from './commons-music-search';
import { isAllowedMusicDownloadHost } from './import-music';

export const OPENVERSE_AUDIO_API_URL = 'https://api.openverse.org/v1/audio/';
export const OPENVERSE_LICENSES = 'by,by-sa,cc0,pdm';
export const OPENVERSE_SEARCH_TIMEOUT_MS = 10_000;
export const MAX_OPENVERSE_RESPONSE_BYTES = 2 * 1024 * 1024;
export const MAX_OPENVERSE_QUERIES = 3;
export const OPENVERSE_PAGE_SIZE_MULTIPLIER = 3;
export const MAX_OPENVERSE_PAGE_SIZE = 20;
const MIN_QUERY_WORD_LENGTH = 3;

const LICENSE_NAMES: Readonly<Record<string, string>> = {
  by: 'CC BY',
  'by-sa': 'CC BY-SA',
  cc0: 'CC0',
  pdm: 'Public Domain Mark',
};

interface OpenverseAudio {
  readonly id?: unknown;
  readonly title?: unknown;
  readonly creator?: unknown;
  readonly license?: unknown;
  readonly license_version?: unknown;
  readonly duration?: unknown;
  readonly url?: unknown;
  readonly foreign_landing_url?: unknown;
  readonly filetype?: unknown;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function licenseName(code: string | null, version: string | null): string | null {
  const name = code === null ? undefined : LICENSE_NAMES[code];
  if (name === undefined) {
    return null;
  }
  return version === null || code === 'pdm' ? name : `${name} ${version}`;
}

function isMusicBedLength(durationMs: number): boolean {
  return durationMs >= MIN_COMMONS_MUSIC_DURATION_SEC * 1000 && durationMs <= MAX_COMMONS_MUSIC_DURATION_SEC * 1000;
}

function downloadFileName(title: string, id: string, filetype: string | null): string {
  const extension = filetype !== null && filetype.startsWith('mp3') ? 'mp3' : (filetype ?? 'mp3');
  const candidate = `${title.replace(/[^\p{L}\p{N} ._()-]+/gu, ' ').replace(/\s+/gu, ' ').trim()}.${extension}`;
  return isPortableFileName(candidate) ? candidate : `openverse-${id}.${extension}`;
}

function parseOpenverseAudio(audio: OpenverseAudio): FreeMusicResult | null {
  const id = text(audio.id);
  const title = text(audio.title);
  const downloadUrl = text(audio.url);
  const pageUrl = text(audio.foreign_landing_url);
  const license = licenseName(text(audio.license), text(audio.license_version));
  const durationMs = typeof audio.duration === 'number' && Number.isFinite(audio.duration) ? Math.round(audio.duration) : null;
  if (id === null || title === null || downloadUrl === null || pageUrl === null || license === null || durationMs === null) {
    return null;
  }
  if (!isFreeCommercialLicense(license) || !isMusicBedLength(durationMs) || !isAllowedMusicDownloadHost(downloadUrl)) {
    return null;
  }
  return {
    resultId: stableResultId('openverse', id),
    title,
    durationMs,
    license,
    author: text(audio.creator) ?? '',
    pageUrl,
    downloadUrl,
    source: 'openverse',
    fileName: downloadFileName(title, id, text(audio.filetype)),
  };
}

export function parseOpenverseSearchPayload(payload: unknown): FreeMusicResult[] {
  const results = typeof payload === 'object' && payload !== null ? (payload as { readonly results?: unknown }).results : undefined;
  if (!Array.isArray(results)) {
    throw new Error('Openverse search returned an unexpected payload shape');
  }
  return results.flatMap((audio: OpenverseAudio) => parseOpenverseAudio(audio) ?? []);
}

export function openverseQueries(mood: string): string[] {
  const words = mood
    .toLowerCase()
    .split(/[^\p{L}\p{N}-]+/u)
    .filter((word) => word.length >= MIN_QUERY_WORD_LENGTH && word !== 'music');
  return [...new Set([mood.trim(), ...words])].slice(0, MAX_OPENVERSE_QUERIES);
}

export function buildOpenverseSearchUrl(query: string, pageSize: number): string {
  const url = new URL(OPENVERSE_AUDIO_API_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('license', OPENVERSE_LICENSES);
  url.searchParams.set('category', 'music');
  url.searchParams.set('page_size', String(pageSize));
  return url.toString();
}

async function fetchOpenversePage(fetchRemote: FetchRemotePort, query: string, pageSize: number): Promise<FreeMusicResult[]> {
  const response = await fetchRemote(buildOpenverseSearchUrl(query, pageSize), {
    headers: { 'user-agent': COMMONS_USER_AGENT, accept: 'application/json' },
    timeoutMs: OPENVERSE_SEARCH_TIMEOUT_MS,
  });
  if (response.status !== 200) {
    throw new Error(`Openverse search responded with status ${response.status}`);
  }
  const bytes = await collectBytes(response.body(), MAX_OPENVERSE_RESPONSE_BYTES, 'Openverse search');
  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder('utf-8').decode(bytes));
  } catch {
    throw new Error('Openverse search returned invalid JSON');
  }
  return parseOpenverseSearchPayload(payload);
}

export async function searchOpenverseMusic(fetchRemote: FetchRemotePort, mood: string, maxResults: number): Promise<FreeMusicResult[]> {
  const pageSize = Math.min(maxResults * OPENVERSE_PAGE_SIZE_MULTIPLIER, MAX_OPENVERSE_PAGE_SIZE);
  const found = new Map<string, FreeMusicResult>();
  for (const query of openverseQueries(mood)) {
    if (found.size >= maxResults) {
      break;
    }
    for (const result of await fetchOpenversePage(fetchRemote, query, pageSize)) {
      found.set(result.resultId, result);
    }
  }
  return [...found.values()].slice(0, maxResults);
}
