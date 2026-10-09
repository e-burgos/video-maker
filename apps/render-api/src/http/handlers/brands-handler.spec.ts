import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { parseCssTokens } from '@video-maker/motion-graphics';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../../__fixtures__/call-log';
import { createFakeObjectStorage } from '../../__fixtures__/fake-object-storage';
import type { FakeObjectStorageFileSeed } from '../../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../../__fixtures__/fake-render-api-dependencies';
import { requestLine } from '../../__fixtures__/http-request';
import type { BrandDetail, BrandListItem } from '../../brands/brand-library';
import type { ServerConfig } from '../../config/server-config';
import type { StoreConfig } from '../../config/store-config';
import type { MotionBrandDocument } from '../../deps/render-api-dependencies';
import { httpStatusFor } from '../../errors/http-status-for';
import { toErrorPayload } from '../../errors/to-error-payload';
import { handleRequest } from '../handle-request';
import { createRenderApiRuntime } from '../render-api-runtime';
import {
  handleCreateBrand,
  handleDeleteBrand,
  handleGetBrand,
  handleGetBrandFile,
  handleListBrands,
  handlePutBrand,
  handlePutBrandFile,
} from './brands-handler';

const STORE: StoreConfig = {
  mediaRoot: '/media',
  dbPath: '/media/.studio/studio.db',
  maxUploadBytes: 2_147_483_648,
  objectStore: 'fs',
  motionAssetsRoot: '/assets',
  brandsRoot: '/brands',
};
const CONFIG: ServerConfig = { host: '127.0.0.1', port: 4310, webRoot: null, accessToken: null };

const REAL_BRAND = fileURLToPath(new URL('../../../../../libs/motion-graphics/assets/brands/displayads/', import.meta.url));
const BRAND_JSON = readFileSync(`${REAL_BRAND}brand.json`, 'utf8');
const BRAND_CSS = readFileSync(`${REAL_BRAND}brand.css`, 'utf8');
const BUILT_IN = '/assets/brands/displayads';

const DETAIL_KEYS = ['files', 'id', 'manifest', 'source', 'tokens'];
const FILES_KEYS = ['fonts', 'images', 'logos', 'music'];
const LIST_ITEM_KEYS = ['id', 'logo', 'name', 'palette', 'source', 'updatedAt'];

const BUILT_IN_FILES: FakeObjectStorageFileSeed[] = [
  { path: `${BUILT_IN}/brand.json`, contents: BRAND_JSON },
  { path: `${BUILT_IN}/brand.css`, contents: BRAND_CSS },
  { path: `${BUILT_IN}/img/logo.svg`, contents: '<svg/>' },
  { path: `${BUILT_IN}/img/isotipo.svg`, contents: '<svg/>' },
  { path: `${BUILT_IN}/img/scenes/easy-pro-cafe.jpg`, contents: 'jpg' },
  { path: `${BUILT_IN}/fonts/outfit-latin-wght-normal.woff2`, contents: 'outfit' },
  { path: `${BUILT_IN}/fonts/outfit-latin-ext-wght-normal.woff2`, contents: 'outfit-ext' },
  { path: `${BUILT_IN}/fonts/geist-latin-wght-normal.woff2`, contents: 'geist' },
  { path: `${BUILT_IN}/fonts/geist-mono-latin-wght-normal.woff2`, contents: 'geist-mono' },
  { path: `${BUILT_IN}/music/Voxel Revolution.mp3`, contents: 'mp3' },
];

const USER_MANIFEST = {
  id: 'mine',
  name: 'Mine',
  spokenName: 'Mine',
  tagline: 'Hecho a mano.',
  logo: 'img/logo.svg',
  palette: { background: '#101820', accent: '#ff5500', accent2: '#00aaff', text: '#ffffff' },
  fonts: [{ family: 'Outfit', file: 'fonts/outfit.woff2' }],
  devices: {},
  images: {},
  music: [],
  voice: { id: 'es_AR-daniela-high', lengthScale: 1.08 },
};
const USER_FILES: FakeObjectStorageFileSeed[] = [
  { path: '/brands/mine/brand.json', contents: JSON.stringify(USER_MANIFEST) },
  { path: '/brands/mine/img/logo.svg', contents: '<svg/>' },
  { path: '/brands/mine/fonts/outfit.woff2', contents: 'font' },
];

async function* textBody(text: string): AsyncGenerator<Uint8Array> {
  yield new TextEncoder().encode(text);
}

function jsonRequest(method: string, path: string, value: unknown) {
  return requestLine({ method, path, body: textBody(JSON.stringify(value)) });
}

function setup(extraFiles: readonly FakeObjectStorageFileSeed[] = [], documents: readonly MotionBrandDocument[] = []) {
  const callLog = createCallLog();
  const storage = createFakeObjectStorage(callLog, { files: [...BUILT_IN_FILES, ...extraFiles] });
  const deps = createFakeRenderApiDependencies(callLog, {
    storage,
    listMotionBrands: async () => [{ id: 'displayads', source: 'built-in', manifest: JSON.parse(BRAND_JSON) as unknown }, ...documents],
  });
  return { deps, storage };
}

async function caught(promise: Promise<unknown>): Promise<ReturnType<typeof toErrorPayload>> {
  return promise.then(
    () => {
      throw new Error('expected the handler to reject');
    },
    (error: unknown) => toErrorPayload(error),
  );
}

async function readText(storage: ReturnType<typeof setup>['storage'], path: string): Promise<string> {
  return storage.readTextFile(path);
}

describe('GET /brands', () => {
  it('lists the built-in brands first and then the user brands by name', async () => {
    const { deps } = setup(USER_FILES, [
      { id: 'zeta', source: 'user', manifest: { ...USER_MANIFEST, id: 'zeta', name: 'Zeta' } },
      { id: 'mine', source: 'user', manifest: USER_MANIFEST },
    ]);

    const response = await handleListBrands(deps, STORE);
    const items = response.body as BrandListItem[];

    expect(response.status).toBe(200);
    expect(items.map((item) => `${item.source}:${item.id}`)).toEqual(['built-in:displayads', 'user:mine', 'user:zeta']);
    for (const item of items) expect(Object.keys(item).sort()).toEqual(LIST_ITEM_KEYS);
    expect(items[0]).toMatchObject({ name: 'Display Ads', logo: 'img/logo.svg', updatedAt: null });
    expect(items[0]?.palette).toEqual({ background: '#09090b', accent: '#0ea5e9', accent2: '#14b8a6', text: '#fafafa' });
    expect(items[1]?.updatedAt).toBe(new Date(1_757_289_600_000).toISOString());
  });

  it('leaves out a user brand whose manifest does not parse instead of failing the whole list', async () => {
    const { deps } = setup([], [{ id: 'broken', source: 'user', manifest: { id: 'broken' } }]);

    const items = (await handleListBrands(deps, STORE)).body as BrandListItem[];

    expect(items.map((item) => item.id)).toEqual(['displayads']);
  });
});

describe('GET /brands/:id', () => {
  it('answers the manifest, the effective variables and the files of a built-in brand', async () => {
    const { deps } = setup();

    const response = await handleGetBrand(deps, STORE, { id: 'displayads' });
    const body = response.body as BrandDetail;

    expect(response.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(DETAIL_KEYS);
    expect(Object.keys(body.files).sort()).toEqual(FILES_KEYS);
    expect(body.source).toBe('built-in');
    expect(body.tokens).toEqual(parseCssTokens(BRAND_CSS));
    expect(body.files.logos).toEqual(['img/isotipo.svg', 'img/logo.svg']);
    expect(body.files.images).toEqual(['img/scenes/easy-pro-cafe.jpg']);
    expect(body.files.music).toEqual(['music/Voxel Revolution.mp3']);
  });

  it('derives the variables of a user brand that only has a palette', async () => {
    const { deps } = setup(USER_FILES);

    const body = (await handleGetBrand(deps, STORE, { id: 'mine' })).body as BrandDetail;

    expect(body.source).toBe('user');
    expect(body.tokens['--mg-accent']).toBe('#ff5500');
    expect(body.tokens['--mg-bg']).toBe('#101820');
  });

  it('answers BRAND_UNKNOWN with 404 and rejects an id that is not a slug', async () => {
    const { deps } = setup();

    const unknown = await caught(handleGetBrand(deps, STORE, { id: 'nope' }));
    const invalid = await caught(handleGetBrand(deps, STORE, { id: '../etc' }));

    expect(unknown.code).toBe('BRAND_UNKNOWN');
    expect(httpStatusFor(unknown.code)).toBe(404);
    expect(invalid.code).toBe('INVALID_INPUT');
  });
});

describe('POST /brands', () => {
  it('creates a starter brand with the DisplayAds palette, fonts and a wordmark that composes right away', async () => {
    const { deps, storage } = setup();

    const response = await handleCreateBrand(deps, STORE, jsonRequest('POST', '/brands', { name: 'Árbol Verde 2' }));
    const body = response.body as BrandDetail;

    expect(response.status).toBe(201);
    expect(response.headers.location).toBe('/brands/arbol-verde-2');
    expect(Object.keys(body).sort()).toEqual(DETAIL_KEYS);
    expect(body).toMatchObject({ id: 'arbol-verde-2', source: 'user' });
    expect(body.manifest).toMatchObject({
      name: 'Árbol Verde 2',
      logo: 'img/logo.svg',
      palette: { background: '#09090b', accent: '#0ea5e9', accent2: '#14b8a6', text: '#fafafa' },
      typography: { display: 'Outfit', body: 'Geist', mono: 'Geist Mono' },
      voice: { id: 'es_AR-daniela-high', lengthScale: 1.08 },
      music: [],
      images: {},
      devices: {},
    });
    expect(body.manifest.css).toBeUndefined();
    expect(body.manifest.fonts.map((font) => font.file)).toEqual([
      'fonts/outfit-latin-wght-normal.woff2',
      'fonts/geist-latin-wght-normal.woff2',
      'fonts/geist-mono-latin-wght-normal.woff2',
    ]);
    expect(body.tokens['--mg-font-display']).toBe('"Outfit", "Geist", sans-serif');
    expect(body.files.fonts).toHaveLength(3);
    expect(body.files.logos).toEqual(['img/logo.svg']);
    const svg = await readText(storage, '/brands/arbol-verde-2/img/logo.svg');
    expect(svg).toContain('Árbol Verde 2');
    expect(svg).toContain('data:font/woff2;base64,');
  });

  it('uses the given id and escapes the name inside the wordmark', async () => {
    const { deps, storage } = setup();

    const body = (await handleCreateBrand(deps, STORE, jsonRequest('POST', '/brands', { name: 'A & <B>', id: 'ab' }))).body as BrandDetail;

    expect(body.id).toBe('ab');
    expect(await readText(storage, '/brands/ab/img/logo.svg')).toContain('A &amp; &lt;B&gt;');
  });

  it('duplicates a brand keeping the look: no css, a palette and every effective variable as tokens', async () => {
    const { deps, storage } = setup();

    const response = await handleCreateBrand(deps, STORE, jsonRequest('POST', '/brands', { name: 'Copia', duplicateFrom: 'displayads' }));
    const body = response.body as BrandDetail;

    expect(response.status).toBe(201);
    expect(Object.keys(body).sort()).toEqual(DETAIL_KEYS);
    expect(body.id).toBe('copia');
    expect(body.manifest.name).toBe('Copia');
    expect(body.manifest.css).toBeUndefined();
    expect(body.manifest.palette).toEqual({ background: '#09090b', accent: '#0ea5e9', accent2: '#14b8a6', text: '#fafafa' });
    expect(body.manifest.tokens).toEqual(parseCssTokens(BRAND_CSS));
    expect(body.tokens).toEqual(parseCssTokens(BRAND_CSS));
    expect(Object.keys(body.manifest.images)).toHaveLength(Object.keys(JSON.parse(BRAND_JSON).images).length);
    expect(body.files.images).toEqual(['img/scenes/easy-pro-cafe.jpg']);
    expect(await storage.stat('/brands/copia/brand.css')).toBeNull();
    expect(await storage.stat('/brands/copia/music/Voxel Revolution.mp3')).not.toBeNull();
  });

  it('derives the palette of a duplicated brand that has only a stylesheet', async () => {
    const authored = { ...JSON.parse(BRAND_JSON), id: 'legacy', palette: undefined, typography: undefined };
    const { deps } = setup([
      { path: '/brands/legacy/brand.json', contents: JSON.stringify(authored) },
      { path: '/brands/legacy/brand.css', contents: BRAND_CSS },
    ]);

    const body = (await handleCreateBrand(deps, STORE, jsonRequest('POST', '/brands', { name: 'Legacy 2', duplicateFrom: 'legacy' }))).body as BrandDetail;

    expect(body.manifest.palette).toEqual({ background: '#09090b', accent: '#0ea5e9', accent2: '#2dd4bf', text: '#fafafa' });
  });

  it('answers BRAND_EXISTS with 409 for any root and rejects bad bodies', async () => {
    const { deps } = setup(USER_FILES);

    const builtIn = await caught(handleCreateBrand(deps, STORE, jsonRequest('POST', '/brands', { name: 'DisplayAds' })));
    const user = await caught(handleCreateBrand(deps, STORE, jsonRequest('POST', '/brands', { name: 'x', id: 'mine' })));
    const missingName = await caught(handleCreateBrand(deps, STORE, jsonRequest('POST', '/brands', { id: 'x' })));
    const unknownSource = await caught(handleCreateBrand(deps, STORE, jsonRequest('POST', '/brands', { name: 'Y', duplicateFrom: 'nope' })));
    const noLetters = await caught(handleCreateBrand(deps, STORE, jsonRequest('POST', '/brands', { name: '!!!' })));
    const notJson = await caught(handleCreateBrand(deps, STORE, requestLine({ method: 'POST', path: '/brands', body: textBody('nope') })));

    expect([builtIn.code, user.code]).toEqual(['BRAND_EXISTS', 'BRAND_EXISTS']);
    expect(httpStatusFor(builtIn.code)).toBe(409);
    expect(missingName.code).toBe('INVALID_INPUT');
    expect(unknownSource.code).toBe('BRAND_UNKNOWN');
    expect(noLetters.code).toBe('INVALID_INPUT');
    expect(notJson.code).toBe('REQUEST_BODY_INVALID_JSON');
  });
});

describe('PUT /brands/:id', () => {
  it('validates, stores and answers the manifest of a user brand', async () => {
    const { deps, storage } = setup(USER_FILES);
    const edited = { ...USER_MANIFEST, tagline: 'Nueva.', tokens: { '--mg-radius': '12px' } };

    const response = await handlePutBrand(deps, STORE, { id: 'mine' }, jsonRequest('PUT', '/brands/mine', edited));
    const body = response.body as BrandDetail;

    expect(response.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(DETAIL_KEYS);
    expect(body.manifest.tagline).toBe('Nueva.');
    expect(body.tokens['--mg-radius']).toBe('12px');
    expect(JSON.parse(await readText(storage, '/brands/mine/brand.json')).tagline).toBe('Nueva.');
  });

  it('answers BRAND_READ_ONLY with 409 for a built-in brand', async () => {
    const { deps } = setup();

    const error = await caught(handlePutBrand(deps, STORE, { id: 'displayads' }, jsonRequest('PUT', '/brands/displayads', JSON.parse(BRAND_JSON))));

    expect(error.code).toBe('BRAND_READ_ONLY');
    expect(httpStatusFor(error.code)).toBe(409);
  });

  it('rejects a manifest that does not parse, names another id or points to files that are not there', async () => {
    const { deps } = setup(USER_FILES);
    const put = (value: unknown) => caught(handlePutBrand(deps, STORE, { id: 'mine' }, jsonRequest('PUT', '/brands/mine', value)));

    const invalid = await put({ ...USER_MANIFEST, palette: { ...USER_MANIFEST.palette, accent: 'blue' } });
    const otherId = await put({ ...USER_MANIFEST, id: 'other' });
    const missingFile = await put({ ...USER_MANIFEST, music: [{ id: 't', file: 'music/t.mp3', credit: 'c', bpm: 100, mood: 'calm' }] });
    const traversal = await put({ ...USER_MANIFEST, logo: '../displayads/img/logo.svg' });

    for (const error of [invalid, otherId, missingFile, traversal]) {
      expect(error.code).toBe('BRAND_MANIFEST_INVALID');
      expect(httpStatusFor(error.code)).toBe(422);
    }
    expect(missingFile.expected).toContain('music/t.mp3');
  });
});

describe('DELETE /brands/:id', () => {
  it('moves the folder to the trash and answers 204', async () => {
    const { deps, storage } = setup(USER_FILES);

    const response = await handleDeleteBrand(deps, STORE, { id: 'mine' });

    expect(response.status).toBe(204);
    expect(await storage.stat('/brands/mine/brand.json')).toBeNull();
    const trashed = (await storage.listDirectory('/brands/.trash')) ?? [];
    expect(trashed).toHaveLength(1);
    expect(trashed[0]?.name).toMatch(/^mine-2/u);
    expect(await storage.stat(`/brands/.trash/${trashed[0]?.name}/img/logo.svg`)).not.toBeNull();
  });

  it('answers 409 BRAND_READ_ONLY for a built-in brand and 404 for an unknown one', async () => {
    const { deps, storage } = setup();

    const builtIn = await caught(handleDeleteBrand(deps, STORE, { id: 'displayads' }));
    const unknown = await caught(handleDeleteBrand(deps, STORE, { id: 'nope' }));

    expect(builtIn.code).toBe('BRAND_READ_ONLY');
    expect(unknown.code).toBe('BRAND_UNKNOWN');
    expect(await storage.stat(`${BUILT_IN}/brand.json`)).not.toBeNull();
  });
});

describe('PUT /brands/:id/files/:kind/:name', () => {
  const upload = (content: string, headers?: Record<string, string>) =>
    requestLine({
      method: 'PUT',
      path: '/brands/mine/files/logo/logo-2.png',
      headers: { 'content-length': String(new TextEncoder().encode(content).length), ...headers },
      body: textBody(content),
    });

  it.each([
    ['logo', 'logo-2.png', 'img/logo-2.png'],
    ['image', 'foto.JPG', 'img/scenes/foto.JPG'],
    ['device', 'box.webp', 'img/devices/box.webp'],
    ['font', 'Brand Sans.ttf', 'fonts/Brand Sans.ttf'],
    ['music', 'tema.m4a', 'music/tema.m4a'],
  ])('stores a %s file under its folder', async (kind, name, path) => {
    const { deps, storage } = setup(USER_FILES);

    const response = await handlePutBrandFile(deps, STORE, { id: 'mine', kind, name }, upload('bytes'));

    expect(response.status).toBe(201);
    expect(Object.keys(response.body as object).sort()).toEqual(['path']);
    expect(response.body).toEqual({ path });
    expect(await storage.stat(`/brands/mine/${path}`)).not.toBeNull();
  });

  it('rejects unknown kinds, wrong extensions and unsafe names', async () => {
    const { deps } = setup(USER_FILES);
    const put = (kind: string, name: string) => caught(handlePutBrandFile(deps, STORE, { id: 'mine', kind, name }, upload('x')));

    const results = await Promise.all([
      put('video', 'a.mp4'),
      put('logo', 'logo.gif'),
      put('font', 'f.woff'),
      put('music', 'm.flac'),
      put('logo', '../logo.png'),
      put('logo', '.hidden.png'),
      put('logo', 'noextension'),
      put('logo', 'a/b.png'),
    ]);

    for (const error of results) expect(error.code).toBe('BRAND_FILE_INVALID');
  });

  it('enforces the size cap of the kind from the content-length and requires it', async () => {
    const { deps } = setup(USER_FILES);
    const huge = requestLine({ method: 'PUT', path: '/x', headers: { 'content-length': String(16 * 1_048_576) }, body: textBody('') });
    const bigFont = requestLine({ method: 'PUT', path: '/x', headers: { 'content-length': String(6 * 1_048_576) }, body: textBody('') });
    const missing = requestLine({ method: 'PUT', path: '/x', body: textBody('x') });

    const logo = await caught(handlePutBrandFile(deps, STORE, { id: 'mine', kind: 'logo', name: 'a.png' }, huge));
    const font = await caught(handlePutBrandFile(deps, STORE, { id: 'mine', kind: 'font', name: 'a.ttf' }, bigFont));
    const noLength = await caught(handlePutBrandFile(deps, STORE, { id: 'mine', kind: 'logo', name: 'a.png' }, missing));

    expect([logo.code, font.code]).toEqual(['ASSET_TOO_LARGE', 'ASSET_TOO_LARGE']);
    expect(noLength.code).toBe('ASSET_CONTENT_LENGTH_REQUIRED');
  });

  it('answers 409 for a built-in brand and 404 for an unknown one', async () => {
    const { deps } = setup(USER_FILES);

    const builtIn = await caught(handlePutBrandFile(deps, STORE, { id: 'displayads', kind: 'logo', name: 'a.png' }, upload('x')));
    const unknown = await caught(handlePutBrandFile(deps, STORE, { id: 'nope', kind: 'logo', name: 'a.png' }, upload('x')));

    expect(builtIn.code).toBe('BRAND_READ_ONLY');
    expect(unknown.code).toBe('BRAND_UNKNOWN');
  });
});

describe('GET /brands/:id/files/*path', () => {
  const get = (id: string, path: string, headers?: Record<string, string>) =>
    requestLine({ method: 'GET', path: `/brands/${id}/files/${path}`, headers: headers ?? {} });

  async function collect(stream: AsyncIterable<Uint8Array>): Promise<string> {
    let text = '';
    for await (const chunk of stream) text += new TextDecoder().decode(chunk);
    return text;
  }

  it('streams a file of a built-in and of a user brand with its content type', async () => {
    const { deps } = setup(USER_FILES);

    const builtIn = await handleGetBrandFile(deps, STORE, { id: 'displayads', path: 'img/logo.svg' }, get('displayads', 'img/logo.svg'));
    const user = await handleGetBrandFile(deps, STORE, { id: 'mine', path: 'fonts/outfit.woff2' }, get('mine', 'fonts/outfit.woff2'));

    expect(builtIn.status).toBe(200);
    expect(builtIn.headers['content-type']).toBe('image/svg+xml');
    expect(await collect(builtIn.stream?.() ?? [])).toBe('<svg/>');
    expect(user.headers['content-type']).toBe('font/woff2');
    expect(user.headers['content-length']).toBe('4');
  });

  it('serves a byte range for music previews', async () => {
    const { deps } = setup();

    const response = await handleGetBrandFile(
      deps,
      STORE,
      { id: 'displayads', path: 'music/Voxel Revolution.mp3' },
      get('displayads', 'music/Voxel Revolution.mp3', { range: 'bytes=1-2' }),
    );

    expect(response.status).toBe(206);
    expect(response.headers['content-range']).toBe('bytes 1-2/3');
    expect(await collect(response.stream?.() ?? [])).toBe('p3');
  });

  it('rejects traversal and answers 404 for a missing file', async () => {
    const { deps } = setup(USER_FILES);
    const fetch = (path: string) => caught(handleGetBrandFile(deps, STORE, { id: 'mine', path }, get('mine', path)));

    const traversal = await fetch('../displayads/brand.json');
    const dotSegment = await fetch('img/./logo.svg');
    const absolute = await fetch('/etc/passwd');
    const missing = await fetch('img/none.png');

    expect([traversal.code, dotSegment.code, absolute.code]).toEqual(['ASSET_PATH_INVALID', 'ASSET_PATH_INVALID', 'ASSET_PATH_INVALID']);
    expect(missing.code).toBe('FILE_NOT_FOUND');
    expect(httpStatusFor(missing.code)).toBe(404);
  });
});

describe('brand routes through handleRequest', () => {
  it('dispatches the seven routes and keeps /motion/brands answering with the user brands too', async () => {
    const { deps } = setup(USER_FILES, [{ id: 'mine', source: 'user', manifest: USER_MANIFEST }]);
    const runtime = createRenderApiRuntime(deps);
    const call = (method: string, path: string, body?: unknown) =>
      handleRequest(body === undefined ? requestLine({ method, path }) : jsonRequest(method, path, body), deps, STORE, runtime, CONFIG);

    const list = await call('GET', '/brands');
    const detail = await call('GET', '/brands/mine');
    const file = await call('GET', '/brands/mine/files/img/logo.svg');
    const motion = await call('GET', '/motion/brands');
    const created = await call('POST', '/brands', { name: 'Nueva' });
    const put = await call('PUT', '/brands/nueva', (created.body as BrandDetail).manifest);
    const removed = await call('DELETE', '/brands/nueva');

    expect([list.status, detail.status, file.status, motion.status, created.status, put.status, removed.status]).toEqual([200, 200, 200, 200, 201, 200, 204]);
    expect((motion.body as Array<{ id: string }>).map((brand) => brand.id)).toEqual(['displayads', 'mine']);
  });
});
