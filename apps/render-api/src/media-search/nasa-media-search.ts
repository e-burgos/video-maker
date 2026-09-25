import type { FetchRemotePort } from '../deps/render-api-dependencies';
import { collectBytes, stableResultId } from './commons-shared';
import type { FreeMediaKind, FreeMediaResult } from './free-media-result';

export const NASA_SEARCH_URL = 'https://images-api.nasa.gov/search';
export const NASA_SEARCH_TIMEOUT_MS = 10_000;
export const MAX_NASA_RESPONSE_BYTES = 5 * 1024 * 1024;
export const NASA_LICENSE = 'NASA (public domain, NASA media usage guidelines)';
export const NASA_DETAILS_BASE_URL = 'https://images.nasa.gov/details';
export const NASA_FETCH_LIMIT_MULTIPLIER = 4;
export const MAX_NASA_CANDIDATES = 24;

function toHttps(url: string): string {
  return url.startsWith('http://') ? `https://${url.slice('http://'.length)}` : url;
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function isNasaCredited(photographer: string | undefined, secondaryCreator: string | undefined): boolean {
  if (photographer === undefined && secondaryCreator === undefined) {
    return true;
  }
  const combined = [photographer, secondaryCreator]
    .filter((value): value is string => value !== undefined)
    .join(' ');
  return combined.toUpperCase().includes('NASA');
}

interface NasaSearchItemData {
  readonly nasa_id?: unknown;
  readonly title?: unknown;
  readonly photographer?: unknown;
  readonly secondary_creator?: unknown;
}

interface NasaSearchItem {
  readonly href?: unknown;
  readonly data?: readonly NasaSearchItemData[];
}

interface NasaSearchPayload {
  readonly collection?: {
    readonly items?: readonly NasaSearchItem[];
  };
}

interface NasaCandidate {
  readonly nasaId: string;
  readonly title: string;
  readonly collectionHref: string;
  readonly author: string;
}

function parseNasaSearchPayload(payload: unknown): readonly NasaCandidate[] {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('NASA Image and Video Library search returned an unexpected payload shape');
  }

  const items = (payload as NasaSearchPayload).collection?.items ?? [];
  const candidates: NasaCandidate[] = [];

  for (const item of items) {
    const entry = item.data?.[0];
    const nasaId = stringField(entry?.nasa_id);
    const title = stringField(entry?.title);
    const collectionHref = stringField(item.href);
    if (nasaId === undefined || title === undefined || collectionHref === undefined) {
      continue;
    }

    const photographer = stringField(entry?.photographer);
    const secondaryCreator = stringField(entry?.secondary_creator);
    if (!isNasaCredited(photographer, secondaryCreator)) {
      continue;
    }

    candidates.push({
      nasaId,
      title,
      collectionHref: toHttps(collectionHref),
      author: photographer ?? secondaryCreator ?? 'NASA',
    });
  }

  return candidates;
}

export function buildNasaSearchUrl(query: string, kind: FreeMediaKind): string {
  const url = new URL(NASA_SEARCH_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('media_type', kind);
  return url.toString();
}

interface NasaAssetPattern {
  readonly preferredSuffix: string;
  readonly fallbackInfix: string | null;
  readonly fallbackExtensions: readonly string[];
}

function assetPatternFor(kind: FreeMediaKind): NasaAssetPattern {
  return kind === 'video'
    ? { preferredSuffix: '~medium.mp4', fallbackInfix: null, fallbackExtensions: [] }
    : { preferredSuffix: '~large.jpg', fallbackInfix: '~orig', fallbackExtensions: ['.jpg', '.jpeg', '.png', '.webp'] };
}

async function fetchNasaAssetUrls(fetchRemote: FetchRemotePort, collectionHref: string): Promise<readonly string[]> {
  let response;
  try {
    response = await fetchRemote(collectionHref, { timeoutMs: NASA_SEARCH_TIMEOUT_MS });
  } catch {
    return [];
  }

  if (response.status !== 200) {
    return [];
  }

  let payload: unknown;
  try {
    const bytes = await collectBytes(response.body(), MAX_NASA_RESPONSE_BYTES, 'NASA collection manifest');
    payload = JSON.parse(new TextDecoder('utf-8').decode(bytes));
  } catch {
    return [];
  }

  // NASA's collection.json is a bare array of asset URL strings, not an { collection: { items } } envelope.
  const entries = Array.isArray(payload) ? payload : [];
  const urls: string[] = [];
  for (const entry of entries) {
    if (typeof entry === 'string') {
      urls.push(toHttps(entry));
    }
  }
  return urls;
}

function pickNasaAssetUrl(urls: readonly string[], kind: FreeMediaKind): string | null {
  const pattern = assetPatternFor(kind);
  const preferred = urls.find((url) => url.endsWith(pattern.preferredSuffix));
  if (preferred !== undefined) {
    return preferred;
  }
  if (pattern.fallbackInfix === null) {
    return null;
  }
  return (
    urls.find(
      (url) =>
        url.includes(pattern.fallbackInfix as string) &&
        pattern.fallbackExtensions.some((extension) => url.toLowerCase().endsWith(extension)),
    ) ?? null
  );
}

export async function searchNasaMedia(
  fetchRemote: FetchRemotePort,
  query: string,
  kind: FreeMediaKind,
  maxResults: number,
): Promise<readonly FreeMediaResult[]> {
  const response = await fetchRemote(buildNasaSearchUrl(query, kind), { timeoutMs: NASA_SEARCH_TIMEOUT_MS });
  if (response.status !== 200) {
    throw new Error(`NASA Image and Video Library search responded with status ${response.status}`);
  }

  const bytes = await collectBytes(response.body(), MAX_NASA_RESPONSE_BYTES, 'NASA Image and Video Library search');
  const text = new TextDecoder('utf-8').decode(bytes);

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error('NASA Image and Video Library search returned invalid JSON');
  }

  const fetchLimit = Math.min(maxResults * NASA_FETCH_LIMIT_MULTIPLIER, MAX_NASA_CANDIDATES);
  const candidates = parseNasaSearchPayload(payload).slice(0, fetchLimit);

  const results: FreeMediaResult[] = [];
  for (const candidate of candidates) {
    if (results.length >= maxResults) {
      break;
    }

    const assetUrls = await fetchNasaAssetUrls(fetchRemote, candidate.collectionHref);
    const downloadUrl = pickNasaAssetUrl(assetUrls, kind);
    if (downloadUrl === null) {
      continue;
    }

    results.push({
      resultId: stableResultId(`nasa-${kind}`, candidate.nasaId),
      source: 'nasa',
      kind,
      title: candidate.title,
      license: NASA_LICENSE,
      author: candidate.author,
      pageUrl: `${NASA_DETAILS_BASE_URL}/${candidate.nasaId}`,
      downloadUrl,
      durationMs: null,
      width: null,
      height: null,
    });
  }

  return results;
}
