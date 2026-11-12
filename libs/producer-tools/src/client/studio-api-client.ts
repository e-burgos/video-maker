import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { basename, extname, isAbsolute } from 'node:path';
import { Readable } from 'node:stream';

import { StudioToolRuntimeError } from '../errors/studio-tool-runtime-error';
import { STUDIO_TOKEN_HEADER, studioErrorFromResponse } from './http-render-api-client';

const REQUEST_TIMEOUT_MS = 30_000;
const UPLOAD_TIMEOUT_MS = 30 * 60_000;
const FALLBACK_CONTENT_TYPE = 'application/octet-stream';

const CONTENT_TYPE_BY_EXTENSION: Readonly<Record<string, string>> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

export interface StudioApiClientOptions {
  readonly apiUrl: string;
  readonly accessToken?: string;
  readonly fetchImpl?: typeof fetch;
}

export interface StudioFileUpload {
  readonly filePath: string;
  readonly fileName?: string;
}

export interface StudioApiClient {
  getHealth(): Promise<Readonly<Record<string, unknown>>>;
  getCapabilities(): Promise<Readonly<Record<string, unknown>>>;
  listProjects(): Promise<readonly unknown[]>;
  createProject(body: Readonly<Record<string, unknown>>): Promise<unknown>;
  uploadProjectAsset(slug: string, role: string, upload: StudioFileUpload): Promise<unknown>;
  listBrands(): Promise<unknown>;
  getBrand(id: string): Promise<unknown>;
  createBrand(body: Readonly<Record<string, unknown>>): Promise<unknown>;
  updateBrand(id: string, manifest: Readonly<Record<string, unknown>>): Promise<unknown>;
  uploadBrandFile(id: string, kind: string, upload: StudioFileUpload): Promise<unknown>;
}

export function contentTypeForFile(filePath: string): string {
  return CONTENT_TYPE_BY_EXTENSION[extname(filePath).toLowerCase()] ?? FALLBACK_CONTENT_TYPE;
}

async function assertReadableLocalFile(filePath: string): Promise<number> {
  if (!isAbsolute(filePath)) {
    throw new StudioToolRuntimeError('INVALID_INPUT', 'filePath must be an absolute path to a file on this machine');
  }
  let size: number;
  try {
    const info = await stat(filePath);
    if (!info.isFile()) {
      throw new StudioToolRuntimeError('INVALID_INPUT', 'filePath must point at a regular file, not a directory');
    }
    size = info.size;
  } catch (cause) {
    if (cause instanceof StudioToolRuntimeError) {
      throw cause;
    }
    throw new StudioToolRuntimeError('FILE_NOT_FOUND', 'the local file does not exist or cannot be read');
  }
  return size;
}

export function createStudioApiClient(options: StudioApiClientOptions): StudioApiClient {
  const apiUrl = options.apiUrl.replace(/\/$/u, '');
  const fetchImpl = options.fetchImpl ?? fetch;

  function authHeaders(extra: Readonly<Record<string, string>> = {}): Record<string, string> {
    return { ...extra, ...(options.accessToken === undefined ? {} : { [STUDIO_TOKEN_HEADER]: options.accessToken }) };
  }

  async function send(method: string, path: string, init: { readonly headers?: Record<string, string>; readonly body?: BodyInit; readonly timeoutMs?: number; readonly duplex?: 'half' }): Promise<unknown> {
    let response: Response;
    try {
      response = await fetchImpl(`${apiUrl}${path}`, {
        method,
        headers: authHeaders(init.headers),
        ...(init.body === undefined ? {} : { body: init.body }),
        ...(init.duplex === undefined ? {} : { duplex: init.duplex }),
        signal: AbortSignal.timeout(init.timeoutMs ?? REQUEST_TIMEOUT_MS),
      } as RequestInit);
    } catch {
      throw new StudioToolRuntimeError('STUDIO_UNAVAILABLE', 'could not reach the render API');
    }
    let json: unknown = null;
    try {
      json = await response.json();
    } catch {
      json = null;
    }
    if (!response.ok) {
      throw studioErrorFromResponse(response.status, json);
    }
    return json;
  }

  const getJson = (path: string) => send('GET', path, {});
  const sendJson = (method: string, path: string, body: unknown) =>
    send(method, path, { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

  async function putFile(path: string, upload: StudioFileUpload): Promise<unknown> {
    const size = await assertReadableLocalFile(upload.filePath);
    return send('PUT', path, {
      headers: { 'content-type': contentTypeForFile(upload.fileName ?? upload.filePath), 'content-length': String(size) },
      body: Readable.toWeb(createReadStream(upload.filePath)) as unknown as BodyInit,
      duplex: 'half',
      timeoutMs: UPLOAD_TIMEOUT_MS,
    });
  }

  return {
    getHealth: async () => (await getJson('/health')) as Record<string, unknown>,
    getCapabilities: async () => (await getJson('/capabilities')) as Record<string, unknown>,
    listProjects: async () => (await getJson('/projects')) as readonly unknown[],
    createProject: (body) => sendJson('POST', '/projects', body),
    uploadProjectAsset: (slug, role, upload) =>
      putFile(`/projects/${encodeURIComponent(slug)}/assets/${encodeURIComponent(role)}/${encodeURIComponent(upload.fileName ?? basename(upload.filePath))}`, upload),
    listBrands: () => getJson('/brands'),
    getBrand: (id) => getJson(`/brands/${encodeURIComponent(id)}`),
    createBrand: (body) => sendJson('POST', '/brands', body),
    updateBrand: (id, manifest) => sendJson('PUT', `/brands/${encodeURIComponent(id)}`, manifest),
    uploadBrandFile: (id, kind, upload) =>
      putFile(`/brands/${encodeURIComponent(id)}/files/${encodeURIComponent(kind)}/${encodeURIComponent(upload.fileName ?? basename(upload.filePath))}`, upload),
  };
}
