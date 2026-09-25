import type { FetchRemotePort } from '../deps/render-api-dependencies';
import { collectBytes, isFreeCommercialLicense, stableResultId, stripHtml } from '../media-search/commons-shared';

export { isFreeCommercialLicense, stripHtml };

export const COMMONS_API_URL = 'https://commons.wikimedia.org/w/api.php';
export const COMMONS_USER_AGENT = 'video-maker-studio/0.1 (local desktop app)';
export const COMMONS_SEARCH_TIMEOUT_MS = 10_000;
export const MAX_COMMONS_RESPONSE_BYTES = 5 * 1024 * 1024;
export const MAX_COMMONS_FETCH_LIMIT = 50;
export const COMMONS_FETCH_LIMIT_MULTIPLIER = 4;

export const ALLOWED_AUDIO_MIME_TYPES = [
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/vnd.wave',
  'audio/flac',
  'audio/x-flac',
  'audio/ogg',
  'audio/opus',
  'application/ogg',
] as const;

export interface CommonsMusicResult {
  readonly resultId: string;
  readonly title: string;
  readonly durationMs: number;
  readonly license: string;
  readonly author: string;
  readonly pageUrl: string;
  readonly downloadUrl: string;
}

function titleFromFileTitle(fileTitle: string): string {
  return fileTitle.startsWith('File:') ? fileTitle.slice('File:'.length) : fileTitle;
}

interface CommonsExtMetadataField {
  readonly value?: unknown;
}

interface CommonsImageInfo {
  readonly url?: unknown;
  readonly descriptionurl?: unknown;
  readonly mime?: unknown;
  readonly duration?: unknown;
  readonly extmetadata?: Readonly<Record<string, CommonsExtMetadataField>>;
}

interface CommonsPage {
  readonly title?: unknown;
  readonly imageinfo?: readonly CommonsImageInfo[];
}

interface CommonsSearchPayload {
  readonly error?: unknown;
  readonly query?: {
    readonly pages?: readonly CommonsPage[];
  };
}

function metadataValue(extmetadata: Readonly<Record<string, CommonsExtMetadataField>> | undefined, key: string): string | undefined {
  const field = extmetadata?.[key];
  return typeof field?.value === 'string' ? field.value : undefined;
}

function parseCommonsPage(page: CommonsPage): CommonsMusicResult | null {
  const fileTitle = typeof page.title === 'string' ? page.title : null;
  const imageInfo = page.imageinfo?.[0];
  if (fileTitle === null || imageInfo === undefined) {
    return null;
  }

  const downloadUrl = typeof imageInfo.url === 'string' ? imageInfo.url : null;
  const pageUrl = typeof imageInfo.descriptionurl === 'string' ? imageInfo.descriptionurl : null;
  const mime = typeof imageInfo.mime === 'string' ? imageInfo.mime : null;
  const durationSeconds = typeof imageInfo.duration === 'number' && Number.isFinite(imageInfo.duration) ? imageInfo.duration : null;

  if (downloadUrl === null || pageUrl === null || mime === null || durationSeconds === null) {
    return null;
  }

  if (!(ALLOWED_AUDIO_MIME_TYPES as readonly string[]).includes(mime)) {
    return null;
  }

  const license = metadataValue(imageInfo.extmetadata, 'LicenseShortName');
  if (!isFreeCommercialLicense(license)) {
    return null;
  }

  const rawAuthor = metadataValue(imageInfo.extmetadata, 'Artist') ?? '';

  return {
    resultId: stableResultId('commons', fileTitle),
    title: titleFromFileTitle(fileTitle),
    durationMs: Math.round(durationSeconds * 1000),
    license: license as string,
    author: stripHtml(rawAuthor),
    pageUrl,
    downloadUrl,
  };
}

export function parseCommonsSearchPayload(payload: unknown): readonly CommonsMusicResult[] {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('Wikimedia Commons search returned an unexpected payload shape');
  }

  const typed = payload as CommonsSearchPayload;
  if (typed.error !== undefined) {
    throw new Error('Wikimedia Commons search returned an error payload');
  }

  const pages = typed.query?.pages ?? [];
  const results: CommonsMusicResult[] = [];
  for (const page of pages) {
    const result = parseCommonsPage(page);
    if (result !== null) {
      results.push(result);
    }
  }
  return results;
}

export function buildCommonsSearchUrl(mood: string, fetchLimit: number): string {
  const url = new URL(COMMONS_API_URL);
  url.searchParams.set('action', 'query');
  url.searchParams.set('generator', 'search');
  url.searchParams.set('gsrnamespace', '6');
  url.searchParams.set('gsrsearch', `${mood} filetype:audio`);
  url.searchParams.set('gsrlimit', String(fetchLimit));
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url|size|mime|extmetadata');
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');
  return url.toString();
}

export async function searchCommonsMusic(
  fetchRemote: FetchRemotePort,
  mood: string,
  maxResults: number,
): Promise<readonly CommonsMusicResult[]> {
  const fetchLimit = Math.min(maxResults * COMMONS_FETCH_LIMIT_MULTIPLIER, MAX_COMMONS_FETCH_LIMIT);
  const url = buildCommonsSearchUrl(mood, fetchLimit);

  const response = await fetchRemote(url, {
    headers: { 'user-agent': COMMONS_USER_AGENT, accept: 'application/json' },
    timeoutMs: COMMONS_SEARCH_TIMEOUT_MS,
  });

  if (response.status !== 200) {
    throw new Error(`Wikimedia Commons search responded with status ${response.status}`);
  }

  const bytes = await collectBytes(response.body(), MAX_COMMONS_RESPONSE_BYTES, 'Wikimedia Commons search');
  const text = new TextDecoder('utf-8').decode(bytes);

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error('Wikimedia Commons search returned invalid JSON');
  }

  return parseCommonsSearchPayload(payload).slice(0, maxResults);
}
