import type { FetchRemotePort } from '../deps/render-api-dependencies';
import { COMMONS_API_URL, COMMONS_SEARCH_TIMEOUT_MS, COMMONS_USER_AGENT } from '../music/commons-music-search';
import { collectBytes, isFreeCommercialLicense, stableResultId, stripHtml } from './commons-shared';
import type { FreeMediaKind, FreeMediaResult } from './free-media-result';

export const MAX_COMMONS_MEDIA_FETCH_LIMIT = 50;
export const COMMONS_MEDIA_FETCH_LIMIT_MULTIPLIER = 4;
export const MAX_COMMONS_MEDIA_RESPONSE_BYTES = 5 * 1024 * 1024;

const ALLOWED_VIDEO_MIME_TYPES = ['video/mp4', 'video/webm'] as const;
const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const OGV_MIME_TYPE = 'video/ogg';
const WEBM_DERIVATIVE_SUFFIX = '.webm';

interface CommonsExtMetadataField {
  readonly value?: unknown;
}

interface CommonsImageInfo {
  readonly url?: unknown;
  readonly descriptionurl?: unknown;
  readonly mime?: unknown;
  readonly duration?: unknown;
  readonly width?: unknown;
  readonly height?: unknown;
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

function titleFromFileTitle(fileTitle: string): string {
  return fileTitle.startsWith('File:') ? fileTitle.slice('File:'.length) : fileTitle;
}

function filetypeKeyword(kind: FreeMediaKind): string {
  return kind === 'video' ? 'filetype:video' : 'filetype:bitmap';
}

export function buildCommonsMediaSearchUrl(query: string, kind: FreeMediaKind, fetchLimit: number): string {
  const url = new URL(COMMONS_API_URL);
  url.searchParams.set('action', 'query');
  url.searchParams.set('generator', 'search');
  url.searchParams.set('gsrnamespace', '6');
  url.searchParams.set('gsrsearch', `${query} ${filetypeKeyword(kind)}`);
  url.searchParams.set('gsrlimit', String(fetchLimit));
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url|size|mime|extmetadata');
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');
  return url.toString();
}

function buildOgvDerivativesUrl(fileTitle: string): string {
  const url = new URL(COMMONS_API_URL);
  url.searchParams.set('action', 'query');
  url.searchParams.set('titles', fileTitle);
  url.searchParams.set('prop', 'videoinfo');
  url.searchParams.set('viprop', 'derivatives');
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');
  return url.toString();
}

interface CommonsDerivative {
  readonly src?: unknown;
}

interface CommonsVideoInfoPage {
  readonly videoinfo?: readonly { readonly derivatives?: readonly CommonsDerivative[] }[];
}

interface CommonsVideoInfoPayload {
  readonly query?: {
    readonly pages?: readonly CommonsVideoInfoPage[];
  };
}

async function resolveOgvWebmDerivative(fetchRemote: FetchRemotePort, fileTitle: string): Promise<string | null> {
  let response;
  try {
    response = await fetchRemote(buildOgvDerivativesUrl(fileTitle), {
      headers: { 'user-agent': COMMONS_USER_AGENT, accept: 'application/json' },
      timeoutMs: COMMONS_SEARCH_TIMEOUT_MS,
    });
  } catch {
    return null;
  }

  if (response.status !== 200) {
    return null;
  }

  let payload: unknown;
  try {
    const bytes = await collectBytes(response.body(), MAX_COMMONS_MEDIA_RESPONSE_BYTES, 'Wikimedia Commons derivatives');
    payload = JSON.parse(new TextDecoder('utf-8').decode(bytes));
  } catch {
    return null;
  }

  const typed = payload as CommonsVideoInfoPayload;
  const derivatives = typed.query?.pages?.[0]?.videoinfo?.[0]?.derivatives ?? [];
  for (const derivative of derivatives) {
    if (typeof derivative.src === 'string' && derivative.src.endsWith(WEBM_DERIVATIVE_SUFFIX)) {
      return derivative.src;
    }
  }
  return null;
}

async function parseCommonsMediaPage(
  fetchRemote: FetchRemotePort,
  page: CommonsPage,
  kind: FreeMediaKind,
): Promise<FreeMediaResult | null> {
  const fileTitle = typeof page.title === 'string' ? page.title : null;
  const imageInfo = page.imageinfo?.[0];
  if (fileTitle === null || imageInfo === undefined) {
    return null;
  }

  const pageUrl = typeof imageInfo.descriptionurl === 'string' ? imageInfo.descriptionurl : null;
  const mime = typeof imageInfo.mime === 'string' ? imageInfo.mime : null;
  const originalDownloadUrl = typeof imageInfo.url === 'string' ? imageInfo.url : null;
  if (pageUrl === null || mime === null || originalDownloadUrl === null) {
    return null;
  }

  const license = metadataValue(imageInfo.extmetadata, 'LicenseShortName');
  if (!isFreeCommercialLicense(license)) {
    return null;
  }

  let downloadUrl = originalDownloadUrl;
  if (kind === 'video' && mime === OGV_MIME_TYPE) {
    const derivative = await resolveOgvWebmDerivative(fetchRemote, fileTitle);
    if (derivative === null) {
      return null;
    }
    downloadUrl = derivative;
  } else {
    const allowedMimeTypes: readonly string[] = kind === 'video' ? ALLOWED_VIDEO_MIME_TYPES : ALLOWED_IMAGE_MIME_TYPES;
    if (!allowedMimeTypes.includes(mime)) {
      return null;
    }
  }

  const durationSeconds = typeof imageInfo.duration === 'number' && Number.isFinite(imageInfo.duration) ? imageInfo.duration : null;
  const width = typeof imageInfo.width === 'number' && Number.isFinite(imageInfo.width) ? imageInfo.width : null;
  const height = typeof imageInfo.height === 'number' && Number.isFinite(imageInfo.height) ? imageInfo.height : null;
  const rawAuthor = metadataValue(imageInfo.extmetadata, 'Artist') ?? '';

  return {
    resultId: stableResultId(`commons-${kind}`, fileTitle),
    source: 'commons',
    kind,
    title: titleFromFileTitle(fileTitle),
    license: license as string,
    author: stripHtml(rawAuthor),
    pageUrl,
    downloadUrl,
    durationMs: kind === 'video' && durationSeconds !== null ? Math.round(durationSeconds * 1000) : null,
    width: kind === 'image' ? width : null,
    height: kind === 'image' ? height : null,
  };
}

export function parseCommonsMediaSearchPayload(
  fetchRemote: FetchRemotePort,
  payload: unknown,
  kind: FreeMediaKind,
): Promise<readonly (FreeMediaResult | null)[]> {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('Wikimedia Commons search returned an unexpected payload shape');
  }

  const typed = payload as CommonsSearchPayload;
  if (typed.error !== undefined) {
    throw new Error('Wikimedia Commons search returned an error payload');
  }

  const pages = typed.query?.pages ?? [];
  return Promise.all(pages.map((page) => parseCommonsMediaPage(fetchRemote, page, kind)));
}

export async function searchCommonsMedia(
  fetchRemote: FetchRemotePort,
  query: string,
  kind: FreeMediaKind,
  maxResults: number,
): Promise<readonly FreeMediaResult[]> {
  const fetchLimit = Math.min(maxResults * COMMONS_MEDIA_FETCH_LIMIT_MULTIPLIER, MAX_COMMONS_MEDIA_FETCH_LIMIT);
  const url = buildCommonsMediaSearchUrl(query, kind, fetchLimit);

  const response = await fetchRemote(url, {
    headers: { 'user-agent': COMMONS_USER_AGENT, accept: 'application/json' },
    timeoutMs: COMMONS_SEARCH_TIMEOUT_MS,
  });

  if (response.status !== 200) {
    throw new Error(`Wikimedia Commons search responded with status ${response.status}`);
  }

  const bytes = await collectBytes(response.body(), MAX_COMMONS_MEDIA_RESPONSE_BYTES, 'Wikimedia Commons search');
  const text = new TextDecoder('utf-8').decode(bytes);

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error('Wikimedia Commons search returned invalid JSON');
  }

  const parsed = await parseCommonsMediaSearchPayload(fetchRemote, payload, kind);
  const results: FreeMediaResult[] = [];
  for (const result of parsed) {
    if (result !== null) {
      results.push(result);
    }
  }
  return results.slice(0, maxResults);
}
