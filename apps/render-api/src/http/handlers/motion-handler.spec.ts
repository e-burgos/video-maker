import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createCallLog } from '../../__fixtures__/call-log';
import { createFakeObjectStorage } from '../../__fixtures__/fake-object-storage';
import type { FakeObjectStorageFileSeed } from '../../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../../__fixtures__/fake-render-api-dependencies';
import { requestLine } from '../../__fixtures__/http-request';
import type { ServerConfig } from '../../config/server-config';
import type { StoreConfig } from '../../config/store-config';
import { httpStatusFor } from '../../errors/http-status-for';
import { toErrorPayload } from '../../errors/to-error-payload';
import { handleRequest } from '../handle-request';
import { createRenderApiRuntime } from '../render-api-runtime';
import {
  handleGetMotionBrief,
  handleGetMotionStoryboard,
  handleListMotionBrands,
  handlePutMotionBrief,
  handlePutMotionStoryboard,
} from './motion-handler';

const STORE: StoreConfig = {
  mediaRoot: '/media',
  dbPath: '/media/.studio/studio.db',
  maxUploadBytes: 2_147_483_648,
  objectStore: 'fs',
  motionAssetsRoot: '/assets',
};
const CONFIG: ServerConfig = { host: '127.0.0.1', port: 4310, webRoot: null, accessToken: null };

const REAL_ASSETS = fileURLToPath(new URL('../../../../../libs/motion-graphics/assets/', import.meta.url));
const BRAND_JSON = readFileSync(`${REAL_ASSETS}brands/displayads/brand.json`, 'utf8');
const STORYBOARD_JSON = readFileSync(`${REAL_ASSETS}storyboards/displayads/core-pro.json`, 'utf8');

const BRAND_SUMMARY_KEYS = ['formats', 'id', 'music', 'name'];
const MUSIC_SUMMARY_KEYS = ['bpm', 'hasDrop', 'id', 'mood'];

async function* textBody(text: string): AsyncGenerator<Uint8Array> {
  yield new TextEncoder().encode(text);
}

function putRequest(path: string, value: unknown) {
  return requestLine({ method: 'PUT', path, body: textBody(JSON.stringify(value)) });
}

function setup(mode: 'motion' | 'footage', files: readonly FakeObjectStorageFileSeed[] = []) {
  const callLog = createCallLog();
  const storage = createFakeObjectStorage(callLog, {
    directories: ['/media/promo', '/media/promo/raw', '/media/promo/raw/images', '/assets/brands/displayads', '/assets/brands/empty'],
    files: [{ path: '/assets/brands/displayads/brand.json', contents: BRAND_JSON }, ...files],
  });
  const deps = createFakeRenderApiDependencies(callLog, { storage });
  deps.localStore.projects.insert('promo', null, mode);
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

const VALID_BRIEF = {
  version: 1,
  brand: 'displayads',
  format: '9:16',
  script: 'Una pantalla apagada es plata perdida.',
  images: [{ file: 'shot.png', caption: 'Pantalla en el local' }],
};

describe('handleListMotionBrands', () => {
  it('lists each brand directory with id, name, formats and music summary', async () => {
    const { deps } = setup('motion');

    const response = await handleListMotionBrands(deps, STORE);

    const brands = response.body as Record<string, unknown>[];
    expect(response.status).toBe(200);
    expect(brands).toHaveLength(1);
    expect(Object.keys(brands[0] ?? {}).sort()).toEqual(BRAND_SUMMARY_KEYS);
    expect(brands[0]).toMatchObject({ id: 'displayads', formats: ['16:9', '9:16'] });
    const music = (brands[0] as { music: Record<string, unknown>[] }).music;
    expect(music.length).toBeGreaterThan(0);
    expect(Object.keys(music[0] ?? {}).sort()).toEqual(MUSIC_SUMMARY_KEYS);
    expect(typeof music[0]?.hasDrop).toBe('boolean');
  });

  it('answers an empty list when the assets root has no brands', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog, { storage: createFakeObjectStorage(callLog) });

    const response = await handleListMotionBrands(deps, STORE);

    expect(response.body).toEqual([]);
  });

  it('rejects a brand.json that does not parse as a manifest', async () => {
    const { deps } = setup('motion', [{ path: '/assets/brands/empty/brand.json', contents: '{"id":"x"}' }]);

    await expect(caught(handleListMotionBrands(deps, STORE))).resolves.toMatchObject({
      code: 'SERVER_CONFIG_INVALID',
    });
  });
});

describe('motion brief handlers', () => {
  it('round-trips a brief through PUT then GET and stores it under motion/brief.json', async () => {
    const { deps, storage } = setup('motion', [{ path: '/media/promo/raw/images/shot.png', contents: 'png' }]);

    const put = await handlePutMotionBrief(deps, STORE, { slug: 'promo' }, putRequest('/projects/promo/motion/brief', VALID_BRIEF));
    const get = await handleGetMotionBrief(deps, STORE, { slug: 'promo' });

    expect(put.status).toBe(200);
    expect(get.body).toEqual(put.body);
    expect(get.body).toMatchObject({ brand: 'displayads', format: '9:16', beatSync: true });
    expect(JSON.parse(await storage.readTextFile('/media/promo/motion/brief.json'))).toEqual(get.body);
  });

  it('answers 404 BRIEF_NOT_FOUND before any brief was saved', async () => {
    const { deps } = setup('motion');

    const payload = await caught(handleGetMotionBrief(deps, STORE, { slug: 'promo' }));

    expect(payload.code).toBe('BRIEF_NOT_FOUND');
    expect(httpStatusFor(payload.code)).toBe(404);
  });

  it('answers 400 BRIEF_INVALID naming the offending field', async () => {
    const { deps } = setup('motion');

    const payload = await caught(
      handlePutMotionBrief(deps, STORE, { slug: 'promo' }, putRequest('/p', { ...VALID_BRIEF, format: '4:3' })),
    );

    expect(payload.code).toBe('BRIEF_INVALID');
    expect(payload.expected).toContain('format');
    expect(httpStatusFor(payload.code)).toBe(400);
  });

  it('answers 400 BRIEF_INVALID naming an image file missing from raw/images', async () => {
    const { deps } = setup('motion');

    const payload = await caught(
      handlePutMotionBrief(deps, STORE, { slug: 'promo' }, putRequest('/p', VALID_BRIEF)),
    );

    expect(payload.code).toBe('BRIEF_INVALID');
    expect(payload.expected).toContain('shot.png');
  });

  it('answers 409 MOTION_PROJECT_REQUIRED for a footage project on both verbs', async () => {
    const { deps } = setup('footage');

    const getPayload = await caught(handleGetMotionBrief(deps, STORE, { slug: 'promo' }));
    const putPayload = await caught(
      handlePutMotionBrief(deps, STORE, { slug: 'promo' }, putRequest('/p', VALID_BRIEF)),
    );

    expect(getPayload.code).toBe('MOTION_PROJECT_REQUIRED');
    expect(putPayload.code).toBe('MOTION_PROJECT_REQUIRED');
    expect(httpStatusFor('MOTION_PROJECT_REQUIRED')).toBe(409);
  });

  it('answers 404 PROJECT_NOT_FOUND for an unknown project', async () => {
    const { deps } = setup('motion');

    await expect(caught(handleGetMotionBrief(deps, STORE, { slug: 'ghost' }))).resolves.toMatchObject({
      code: 'PROJECT_NOT_FOUND',
    });
  });
});

describe('motion storyboard handlers', () => {
  it('round-trips a valid storyboard through PUT then GET', async () => {
    const { deps } = setup('motion');
    const document = JSON.parse(STORYBOARD_JSON) as unknown;

    const put = await handlePutMotionStoryboard(deps, STORE, { slug: 'promo' }, putRequest('/p', document));
    const get = await handleGetMotionStoryboard(deps, STORE, { slug: 'promo' });

    expect(put.status).toBe(200);
    expect(get.body).toEqual(put.body);
    expect(get.body).toMatchObject({ version: 1 });
  });

  it('answers STORYBOARD_NOT_FOUND when none was stored', async () => {
    const { deps } = setup('motion');

    await expect(caught(handleGetMotionStoryboard(deps, STORE, { slug: 'promo' }))).resolves.toMatchObject({
      code: 'STORYBOARD_NOT_FOUND',
    });
  });

  it('answers STORYBOARD_INVALID for a document the parser rejects and stores nothing', async () => {
    const { deps, storage } = setup('motion');

    const payload = await caught(
      handlePutMotionStoryboard(deps, STORE, { slug: 'promo' }, putRequest('/p', { version: 1, scenes: [] })),
    );

    expect(payload.code).toBe('STORYBOARD_INVALID');
    expect(await storage.stat('/media/promo/motion/storyboard.json')).toBeNull();
  });

  it('answers 409 MOTION_PROJECT_REQUIRED for a footage project', async () => {
    const { deps } = setup('footage');

    await expect(caught(handleGetMotionStoryboard(deps, STORE, { slug: 'promo' }))).resolves.toMatchObject({
      code: 'MOTION_PROJECT_REQUIRED',
    });
  });
});

describe('motion routes through handleRequest', () => {
  it('serves the brands list and a brief PUT/GET over the router', async () => {
    const { deps } = setup('motion', [{ path: '/media/promo/raw/images/shot.png', contents: 'png' }]);
    const runtime = createRenderApiRuntime(deps);

    const brands = await handleRequest(requestLine({ method: 'GET', path: '/motion/brands' }), deps, STORE, runtime, CONFIG);
    const put = await handleRequest(putRequest('/projects/promo/motion/brief', VALID_BRIEF), deps, STORE, runtime, CONFIG);
    const get = await handleRequest(requestLine({ method: 'GET', path: '/projects/promo/motion/brief' }), deps, STORE, runtime, CONFIG);

    expect([brands.status, put.status, get.status]).toEqual([200, 200, 200]);
    expect(get.body).toEqual(put.body);
  });
});
