import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createCallLog } from '../../__fixtures__/call-log';
import { createFakeObjectStorage } from '../../__fixtures__/fake-object-storage';
import type { FakeObjectStorageFileSeed } from '../../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../../__fixtures__/fake-render-api-dependencies';
import { requestLine } from '../../__fixtures__/http-request';
import type { MotionBrandDocument } from '../../deps/render-api-dependencies';
import type { MotionOverview } from '../../motion/read-motion-overview';
import type { ServerConfig } from '../../config/server-config';
import type { StoreConfig } from '../../config/store-config';
import { httpStatusFor } from '../../errors/http-status-for';
import { toErrorPayload } from '../../errors/to-error-payload';
import { handleRequest } from '../handle-request';
import { createRenderApiRuntime } from '../render-api-runtime';
import {
  handleGetMotionBrief,
  handleGetMotionOverview,
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
  motionAssetsRoot: '/assets', brandsRoot: '/brands',
};
const CONFIG: ServerConfig = { host: '127.0.0.1', port: 4310, webRoot: null, accessToken: null };

const REAL_ASSETS = fileURLToPath(new URL('../../../../../libs/motion-graphics/assets/', import.meta.url));
const BRAND_JSON = readFileSync(`${REAL_ASSETS}brands/displayads/brand.json`, 'utf8');
const STORYBOARD_JSON = readFileSync(`${REAL_ASSETS}storyboards/displayads/easy-pro.json`, 'utf8');

const BRAND_SUMMARY_KEYS = ['formats', 'id', 'music', 'name'];
const MUSIC_SUMMARY_KEYS = ['bpm', 'hasDrop', 'id', 'mood'];

async function* textBody(text: string): AsyncGenerator<Uint8Array> {
  yield new TextEncoder().encode(text);
}

function putRequest(path: string, value: unknown) {
  return requestLine({ method: 'PUT', path, body: textBody(JSON.stringify(value)) });
}

function setup(
  mode: 'motion' | 'footage',
  files: readonly FakeObjectStorageFileSeed[] = [],
  brands: readonly MotionBrandDocument[] = [{ id: 'displayads', source: 'built-in', manifest: JSON.parse(BRAND_JSON) as unknown }],
) {
  const callLog = createCallLog();
  const storage = createFakeObjectStorage(callLog, {
    directories: ['/media/promo', '/media/promo/raw', '/media/promo/raw/images'],
    files,
  });
  const deps = createFakeRenderApiDependencies(callLog, { storage, listMotionBrands: async () => brands });
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

    const response = await handleListMotionBrands(deps);

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
    const { deps } = setup('motion', [], []);

    const response = await handleListMotionBrands(deps);

    expect(response.body).toEqual([]);
  });

  it('rejects a brand.json that does not parse as a manifest', async () => {
    const { deps } = setup('motion', [], [{ id: 'broken', manifest: { id: 'x' } }]);

    await expect(caught(handleListMotionBrands(deps))).resolves.toMatchObject({
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

  it('answers 400 BRAND_NOT_FOUND when the brief names a brand that is not installed', async () => {
    const { deps } = setup('motion', [{ path: '/media/promo/raw/images/shot.png', contents: 'png' }]);

    const payload = await caught(
      handlePutMotionBrief(deps, STORE, { slug: 'promo' }, putRequest('/p', { ...VALID_BRIEF, brand: 'ghost' })),
    );

    expect(payload.code).toBe('BRAND_NOT_FOUND');
    expect(payload.resource).toBe('ghost');
    expect(httpStatusFor(payload.code)).toBe(400);
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

function storyboardWithImages(images: readonly string[]): unknown {
  const base = JSON.parse(STORYBOARD_JSON) as { scenes: Record<string, unknown>[] };
  const gallery = {
    id: 'gallery-casos',
    kind: 'gallery',
    vo: 'Mirá estos casos reales.',
    chapter: 'Casos',
    props: { images },
  };
  return { ...base, scenes: [...base.scenes.filter((scene) => scene.kind !== 'gallery'), gallery] };
}

describe('motion storyboard image refs', () => {
  const rawImages = [
    { path: '/media/promo/raw/images/cafe.jpeg', contents: 'jpg' },
    { path: '/media/promo/raw/images/food-market.png', contents: 'png' },
  ];

  it('accepts images/<file> from raw/images', async () => {
    const { deps } = setup('motion', rawImages);

    const response = await handlePutMotionStoryboard(
      deps,
      STORE,
      { slug: 'promo' },
      putRequest('/p', storyboardWithImages(['images/cafe.jpeg', 'images/food-market.png'])),
    );

    expect(response.status).toBe(200);
  });

  it('accepts a brand:<key> the brand kit provides', async () => {
    const { deps } = setup('motion', rawImages);
    const key = Object.keys((JSON.parse(BRAND_JSON) as { images: Record<string, unknown> }).images)[0] ?? '';

    const response = await handlePutMotionStoryboard(
      deps,
      STORE,
      { slug: 'promo' },
      putRequest('/p', storyboardWithImages(['images/cafe.jpeg', `brand:${key}`])),
    );

    expect(response.status).toBe(200);
  });

  it.each(['cafe.jpeg', 'raw/images/cafe.jpeg', 'images/missing.png', 'images/../x.png', 'brand:ghost'])(
    'rejects "%s" naming the scene, the ref, the format and the available refs, and stores nothing',
    async (ref) => {
      const { deps, storage } = setup('motion', rawImages);

      const payload = await caught(
        handlePutMotionStoryboard(deps, STORE, { slug: 'promo' }, putRequest('/p', storyboardWithImages(['images/cafe.jpeg', ref]))),
      );

      expect(payload.code).toBe('STORYBOARD_INVALID');
      expect(payload.resource).toBe('motion/storyboard.json');
      expect(payload.expected).toContain('scene "gallery-casos"');
      expect(payload.expected).toContain(`image "${ref}"`);
      expect(payload.expected).toContain('images/<file in raw/images> or brand:<key>');
      expect(payload.expected).toContain('images/cafe.jpeg, images/food-market.png');
      expect(payload.expected).toContain('brand:');
      expect(await storage.stat('/media/promo/motion/storyboard.json')).toBeNull();
    },
  );
});

const OVERVIEW_KEYS = ['storyboard', 'timeline', 'video', 'voice'];
const TIMELINE_KEYS = ['beatSync', 'bpm', 'durationSec', 'musicCredit', 'scenes'];
const TIMELINE_SCENE_KEYS = ['endSec', 'id', 'startSec', 'voDurationSec', 'voStartSec'];
const VOICE_SCENE_KEYS = ['durationSec', 'path', 'sceneId', 'stale', 'vo', 'voice', 'voicedText'];
const VIDEO_KEYS = ['credits', 'creditsPath', 'modifiedAt', 'outdated', 'path'];

describe('handleGetMotionOverview', () => {
  const storyboard = JSON.parse(STORYBOARD_JSON) as { scenes: { id: string; vo: string }[] };
  const [first, second, third] = storyboard.scenes as [{ id: string; vo: string }, { id: string; vo: string }, { id: string; vo: string }];
  const storyboardFile = { path: '/media/promo/motion/storyboard.json', contents: STORYBOARD_JSON, modifiedAtMs: 5_000 };
  const manifest = {
    [first.id]: { vo: first.vo, voice: 'es_AR-daniela-high', lengthScale: 1.08 },
    [second.id]: { vo: 'texto viejo', voice: 'es_AR-daniela-high', lengthScale: 1.08 },
  };
  const timeline = {
    beatSync: true,
    duration: 12.5,
    bpm: 122,
    musicCredit: 'Tema - Autor',
    scenes: [{ id: first.id, start: 0, end: 4, voStart: 0.25, voDuration: 3.5 }],
  };
  const workFiles = [
    { path: '/media/promo/work/motion/voice-manifest.json', contents: JSON.stringify(manifest) },
    { path: '/media/promo/work/motion/timeline.json', contents: JSON.stringify(timeline) },
    { path: `/media/promo/work/motion/assets/audio/vo-${first.id}.wav`, contents: 'wav' },
    { path: `/media/promo/work/motion/assets/audio/vo-${second.id}.wav`, contents: 'wav' },
  ];

  it('answers nulls for a project that has produced nothing yet', async () => {
    const { deps } = setup('motion');

    const response = await handleGetMotionOverview(deps, STORE, { slug: 'promo' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ storyboard: null, timeline: null, voice: null, video: null });
  });

  it('assembles storyboard, timeline, voice and the newest video with their exact keys', async () => {
    const { deps } = setup('motion', [
      storyboardFile,
      ...workFiles,
      { path: '/media/promo/out/old.mp4', contents: 'a', modifiedAtMs: 1_000 },
      { path: '/media/promo/out/video.mp4', contents: 'b', modifiedAtMs: 9_000 },
      { path: '/media/promo/out/video.credits.txt', contents: '  Tema - Autor  \n' },
      { path: '/media/promo/out/.hidden.mp4', contents: 'c', modifiedAtMs: 99_000 },
      { path: '/media/promo/out/sub/deep.mp4', contents: 'd', modifiedAtMs: 99_000 },
    ]);

    const response = await handleGetMotionOverview(deps, STORE, { slug: 'promo' });
    const body = response.body as { [Key in keyof MotionOverview]: NonNullable<MotionOverview[Key]> };

    expect(Object.keys(body).sort()).toEqual(OVERVIEW_KEYS);
    expect(body.storyboard.version).toBe(1);
    expect(Object.keys(body.timeline).sort()).toEqual(TIMELINE_KEYS);
    expect(Object.keys(body.timeline.scenes[0]).sort()).toEqual(TIMELINE_SCENE_KEYS);
    expect(body.timeline).toMatchObject({ durationSec: 12.5, bpm: 122, beatSync: true, musicCredit: 'Tema - Autor' });
    expect(body.voice.scenes.map((scene: { sceneId: string }) => scene.sceneId)).toEqual(
      storyboard.scenes.map((scene) => scene.id),
    );
    expect(Object.keys(body.voice.scenes[0]).sort()).toEqual(VOICE_SCENE_KEYS);
    expect(body.voice.scenes[0]).toMatchObject({
      sceneId: first.id,
      voicedText: first.vo,
      voice: 'es_AR-daniela-high',
      path: `work/motion/assets/audio/vo-${first.id}.wav`,
      durationSec: 3.5,
      stale: false,
    });
    expect(Object.keys(body.video).sort()).toEqual(VIDEO_KEYS);
    expect(body.video).toMatchObject({
      path: 'out/video.mp4',
      creditsPath: 'out/video.credits.txt',
      credits: 'Tema - Autor',
      modifiedAt: new Date(9_000).toISOString(),
      outdated: false,
    });
  });

  it('flags a scene stale when its line changed or its audio is missing', async () => {
    const { deps } = setup('motion', [storyboardFile, ...workFiles]);

    const body = (await handleGetMotionOverview(deps, STORE, { slug: 'promo' })).body as {
      voice: { scenes: { sceneId: string; stale: boolean; voicedText: string | null; path: string | null; durationSec: number | null }[] };
    };

    const byId = new Map(body.voice.scenes.map((scene) => [scene.sceneId, scene]));
    expect(byId.get(second.id)).toMatchObject({ stale: true, voicedText: 'texto viejo' });
    expect(byId.get(third.id)).toMatchObject({ stale: true, voicedText: null, path: null, durationSec: null });
  });

  it('marks the video outdated when the storyboard was saved after it', async () => {
    const { deps } = setup('motion', [
      storyboardFile,
      { path: '/media/promo/out/video.mp4', contents: 'b', modifiedAtMs: 4_000 },
    ]);

    const body = (await handleGetMotionOverview(deps, STORE, { slug: 'promo' })).body as {
      video: { outdated: boolean; creditsPath: string | null; credits: string | null };
    };

    expect(body.video).toMatchObject({ outdated: true, creditsPath: null, credits: null });
  });

  it('lists the manifest scenes when there is no storyboard and ignores an unparsable timeline', async () => {
    const { deps } = setup('motion', [
      workFiles[0] as { path: string; contents: string },
      { path: '/media/promo/work/motion/timeline.json', contents: '{nope' },
    ]);

    const body = (await handleGetMotionOverview(deps, STORE, { slug: 'promo' })).body as {
      storyboard: null;
      timeline: null;
      voice: { scenes: { sceneId: string; vo: string }[] };
    };

    expect(body.storyboard).toBeNull();
    expect(body.timeline).toBeNull();
    expect(body.voice.scenes.map((scene) => scene.sceneId)).toEqual([first.id, second.id]);
    expect(body.voice.scenes[1]?.vo).toBe('texto viejo');
  });

  it('answers 409 MOTION_PROJECT_REQUIRED for a footage project', async () => {
    const { deps } = setup('footage');

    await expect(caught(handleGetMotionOverview(deps, STORE, { slug: 'promo' }))).resolves.toMatchObject({
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
