import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { MotionStudioError } from '@video-maker/motion-graphics';
import type { MotionPipelinePorts } from '@video-maker/motion-graphics';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeObjectStorage } from '../__fixtures__/fake-object-storage';
import type { FakeObjectStorageFileSeed } from '../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import { requestLine } from '../__fixtures__/http-request';
import type { ServerConfig } from '../config/server-config';
import type { StoreConfig } from '../config/store-config';
import { httpStatusFor } from '../errors/http-status-for';
import { toErrorPayload } from '../errors/to-error-payload';
import { handleRequest } from '../http/handle-request';
import { handleGetBrandPreviewFile, handlePostBrandPreview } from '../http/handlers/brands-handler';
import { createRenderApiRuntime } from '../http/render-api-runtime';

const STORE: StoreConfig = {
  mediaRoot: '/media',
  dbPath: '/media/.studio/studio.db',
  maxUploadBytes: 2_147_483_648,
  objectStore: 'fs',
  motionAssetsRoot: '/assets',
  brandsRoot: '/brands',
};
const CONFIG: ServerConfig = { host: '127.0.0.1', port: 4310, webRoot: null, accessToken: null };
const REAL_BRAND = fileURLToPath(new URL('../../../../libs/motion-graphics/assets/brands/displayads/', import.meta.url));
const BRAND_JSON = readFileSync(`${REAL_BRAND}brand.json`, 'utf8');
const BRAND_CSS = readFileSync(`${REAL_BRAND}brand.css`, 'utf8');
const USER_MANIFEST = {
  id: 'mine',
  name: 'Mine',
  spokenName: 'Mine',
  tagline: 'Hecho a mano.',
  url: 'mine.test',
  logo: 'img/logo.svg',
  palette: { background: '#101820', accent: '#ff5500', accent2: '#00aaff', text: '#ffffff' },
  fonts: [{ family: 'Outfit', file: 'fonts/outfit.woff2' }],
  devices: {},
  images: {},
  music: [],
  voice: { id: 'es_AR-daniela-high', lengthScale: 1.08 },
};
const FILES: FakeObjectStorageFileSeed[] = [
  { path: '/assets/brands/displayads/brand.json', contents: BRAND_JSON },
  { path: '/assets/brands/displayads/brand.css', contents: BRAND_CSS },
  { path: '/assets/brands/displayads/img/logo.svg', contents: '<svg/>' },
  { path: '/brands/mine/brand.json', contents: JSON.stringify(USER_MANIFEST) },
  { path: '/brands/mine/img/logo.svg', contents: '<svg/>' },
  { path: '/brands/mine/fonts/outfit.woff2', contents: 'font' },
  { path: '/brands/.preview/mine/stale.txt', contents: 'stale' },
];

const RUNTIME_STUB = '/assets/runtime';

function setup(composeFailure?: Error) {
  const callLog = createCallLog();
  const storage = createFakeObjectStorage(callLog, { files: FILES });
  const ports: MotionPipelinePorts = {
    assetsRoot: '/assets',
    userBrandsRoot: '/brands',
    readText: (path) => storage.readTextFile(path),
    readBytes: async () => new Uint8Array(),
    writeText: (path, content) => storage.writeTextFile(path, content),
    exists: async (path) => (await storage.stat(path)) !== null,
    copyTree: async (from, to) => {
      if (composeFailure !== undefined && from !== RUNTIME_STUB) throw composeFailure;
      await storage.writeTextFile(`${to}/.copied-from`, from);
    },
    copyFile: (from, to) => storage.copyFile(from, to),
    removeFile: (path) => storage.removeFile(path),
    synthesize: async () => undefined,
    transcribe: async () => ({ text: '', words: [] }),
    detectBeats: async () => '',
    trimAudio: async () => undefined,
    render: async () => undefined,
    askAgent: async () => {
      throw new Error('not expected');
    },
  };
  const deps = createFakeRenderApiDependencies(callLog, { storage, motionPorts: () => ports });
  return { deps, storage };
}

function jsonRequest(method: string, path: string, value: unknown) {
  async function* body(): AsyncGenerator<Uint8Array> {
    yield new TextEncoder().encode(JSON.stringify(value));
  }
  return requestLine({ method, path, body: body() });
}

async function caught(promise: Promise<unknown>): Promise<ReturnType<typeof toErrorPayload>> {
  return promise.then(
    () => {
      throw new Error('expected the handler to reject');
    },
    (error: unknown) => toErrorPayload(error),
  );
}

async function previewHtml(storage: ReturnType<typeof setup>['storage'], id: string): Promise<string> {
  return storage.readTextFile(`/brands/.preview/${id}/index.html`);
}

describe('POST /brands/:id/preview', () => {
  it('answers the preview url, the compose time and the fixed duration', async () => {
    const { deps } = setup();

    const response = await handlePostBrandPreview(deps, STORE, createRenderApiRuntime(deps), { id: 'mine' }, requestLine({ method: 'POST', path: '/brands/mine/preview' }));
    const body = response.body as { url: string; composedAt: string; durationSec: number };

    expect(response.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(['composedAt', 'durationSec', 'url']);
    expect(body.url).toBe('/brands/mine/preview/index.html');
    expect(body.durationSec).toBe(9);
    expect(Number.isNaN(Date.parse(body.composedAt))).toBe(false);
  });

  it('composes the opening and the closing with the brand logo, no voice and the live-token listener', async () => {
    const { deps, storage } = setup();

    await handlePostBrandPreview(deps, STORE, createRenderApiRuntime(deps), { id: 'displayads' }, requestLine({ method: 'POST', path: '/brands/displayads/preview' }));
    const html = await previewHtml(storage, 'displayads');
    const timeline = JSON.parse(await storage.readTextFile('/brands/.preview/displayads/timeline.json')) as {
      scenes: Array<{ id: string; voDuration: number }>;
    };

    expect(html).toContain('data-scene="reveal"');
    expect(html).toContain('data-scene="cta"');
    expect(html).toContain('assets/brand/img/logo.svg');
    expect(html).toContain("data.type !== 'mg-brand-tokens'");
    expect(html).toContain('window.__timelines');
    expect(html).toContain('repeat(-1)');
    expect(html).not.toContain('<audio');
    expect(timeline.scenes.map((scene) => [scene.id, scene.voDuration])).toEqual([['reveal', 0], ['cta', 0]]);
    expect(await storage.readTextFile('/brands/.preview/displayads/words.json')).toBe('{}\n');
  });

  it('defaults to the brand tagline and applies the tagline and headline overrides', async () => {
    const { deps, storage } = setup();
    const post = (body: unknown) => handlePostBrandPreview(deps, STORE, createRenderApiRuntime(deps), { id: 'mine' }, jsonRequest('POST', '/brands/mine/preview', body));

    await post({});
    const defaults = await previewHtml(storage, 'mine');
    await post({ tagline: 'Cerrá hoy', headline: 'Abrí mañana' });
    const overridden = await previewHtml(storage, 'mine');

    expect(defaults).toContain('Hecho a mano.');
    expect(defaults).toContain('mine.test');
    expect(overridden).toContain('Abrí mañana');
    expect(overridden).toContain('Cerrá hoy');
  });

  it('wipes the previous preview before composing again', async () => {
    const { deps, storage } = setup();

    await handlePostBrandPreview(deps, STORE, createRenderApiRuntime(deps), { id: 'mine' }, requestLine({ method: 'POST', path: '/brands/mine/preview' }));

    expect(await storage.stat('/brands/.preview/mine/stale.txt')).toBeNull();
  });

  it('answers BRAND_UNKNOWN with 404 and INVALID_INPUT for a blank override', async () => {
    const { deps } = setup();

    const unknown = await caught(handlePostBrandPreview(deps, STORE, createRenderApiRuntime(deps), { id: 'nope' }, requestLine({ method: 'POST', path: '/brands/nope/preview' })));
    const blank = await caught(handlePostBrandPreview(deps, STORE, createRenderApiRuntime(deps), { id: 'mine' }, jsonRequest('POST', '/brands/mine/preview', { tagline: '  ' })));

    expect(unknown.code).toBe('BRAND_UNKNOWN');
    expect(httpStatusFor(unknown.code)).toBe(404);
    expect(blank.code).toBe('INVALID_INPUT');
  });

  it('translates a composition failure into the motion error code instead of a bare 500', async () => {
    const { deps } = setup(new MotionStudioError('ASSET_MISSING', 'brand file missing'));

    const failure = await caught(handlePostBrandPreview(deps, STORE, createRenderApiRuntime(deps), { id: 'mine' }, requestLine({ method: 'POST', path: '/brands/mine/preview' })));

    expect(failure.code).toBe('FILE_NOT_FOUND');
  });
});

describe('GET /brands/:id/preview/*path', () => {
  async function read(response: Awaited<ReturnType<typeof handleGetBrandPreviewFile>>): Promise<string> {
    const chunks: string[] = [];
    for await (const chunk of response.stream?.() ?? []) chunks.push(new TextDecoder().decode(chunk));
    return chunks.join('');
  }

  it('answers FILE_NOT_FOUND until a preview exists and then serves its files without caching', async () => {
    const { deps } = setup();
    const get = (path: string) => handleGetBrandPreviewFile(deps, STORE, { id: 'displayads', path }, requestLine({ method: 'GET', path: `/brands/displayads/preview/${path}` }));

    const before = await caught(get('index.html'));
    await handlePostBrandPreview(deps, STORE, createRenderApiRuntime(deps), { id: 'displayads' }, requestLine({ method: 'POST', path: '/brands/displayads/preview' }));
    const served = await get('index.html');

    expect(before.code).toBe('FILE_NOT_FOUND');
    expect(served.status).toBe(200);
    expect(served.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(served.headers['cache-control']).toBe('no-store');
    expect(await read(served)).toContain('data-scene="cta"');
  });

  it('refuses path traversal and answers BRAND_UNKNOWN for another brand', async () => {
    const { deps } = setup();
    const get = (id: string, path: string) => handleGetBrandPreviewFile(deps, STORE, { id, path }, requestLine({ method: 'GET', path: `/brands/${id}/preview/${path}` }));

    const traversal = await caught(get('mine', '../mine/brand.json'));
    const unknown = await caught(get('nope', 'index.html'));

    expect(traversal.code).toBe('ASSET_PATH_INVALID');
    expect(unknown.code).toBe('BRAND_UNKNOWN');
  });

  it('is reachable through handleRequest for both verbs', async () => {
    const { deps } = setup();
    const runtime = createRenderApiRuntime(deps);
    const call = (method: string, path: string) => handleRequest(requestLine({ method, path }), deps, STORE, runtime, CONFIG);

    const composed = await call('POST', '/brands/mine/preview');
    const asset = await call('GET', '/brands/mine/preview/assets/brand/brand.css');
    const page = await call('GET', '/brands/mine/preview/index.html');

    expect([composed.status, asset.status, page.status]).toEqual([200, 200, 200]);
    expect(asset.headers['content-type']).toBe('text/css; charset=utf-8');
  });
});
