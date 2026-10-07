import { describe, expect, it } from 'vitest';

import { createCallLog } from '../../__fixtures__/call-log';
import { createFakeObjectStorage } from '../../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../../__fixtures__/fake-render-api-dependencies';
import type { StoreConfig } from '../../config/store-config';
import { GENERATED_ROOTS, handleGetGenerated } from './generated-handler';
import type { GeneratedBody } from './generated-handler';

const STORE: StoreConfig = { mediaRoot: '/media', dbPath: '/media/.studio/studio.db', maxUploadBytes: 2_147_483_648, objectStore: 'fs', motionAssetsRoot: '/repo/libs/motion-graphics/assets' };
const PROJECT_ROOT = '/media/display-ads';

function dependencies(files: readonly { path: string; contents: string }[]) {
  const callLog = createCallLog();
  const storage = createFakeObjectStorage(callLog, {
    directories: [PROJECT_ROOT],
    files: [...files],
  });
  return { deps: createFakeRenderApiDependencies(callLog, { storage }), callLog };
}

const SEED = [
  { path: `${PROJECT_ROOT}/raw/aroll/screen.mp4`, contents: 'aroll' },
  { path: `${PROJECT_ROOT}/work/catalog.json`, contents: '{}' },
  { path: `${PROJECT_ROOT}/work/timeline.json`, contents: '{}' },
  { path: `${PROJECT_ROOT}/work/voice/voice.wav`, contents: 'wav-bytes' },
  { path: `${PROJECT_ROOT}/work/voice/voice.words.json`, contents: '{}' },
  { path: `${PROJECT_ROOT}/work/voice/lines/line-01.wav`, contents: 'line' },
  { path: `${PROJECT_ROOT}/work/producer/script.txt`, contents: '[0:00] Hola' },
  { path: `${PROJECT_ROOT}/work/producer/session.json`, contents: '{}' },
  { path: `${PROJECT_ROOT}/out/display-ads.mp4`, contents: 'mp4-bytes' },
];

async function generatedBody(): Promise<GeneratedBody> {
  const { deps } = dependencies(SEED);
  const response = await handleGetGenerated(deps, STORE, { slug: 'display-ads' });

  expect(response.status).toBe(200);
  return response.body as GeneratedBody;
}

describe('handleGetGenerated (EP-028, FIX-006-001)', () => {
  it('se confina a work/voice, work/producer y out', async () => {
    expect([...GENERATED_ROOTS]).toEqual(['work/voice', 'work/producer', 'out']);
  });

  it('lista sólo lo que produjo el motor, nunca raw/ ni el resto de work/', async () => {
    const body = await generatedBody();

    expect(body.files.map((file) => file.path)).toEqual([
      'work/voice/lines/line-01.wav',
      'work/voice/voice.wav',
      'work/voice/voice.words.json',
      'work/producer/script.txt',
      'work/producer/session.json',
      'out/display-ads.mp4',
    ]);
  });

  it('devuelve la forma exacta del contrato', async () => {
    const body = await generatedBody();

    expect(Object.keys(body).sort()).toEqual(['files', 'roots', 'slug']);
    expect(body.slug).toBe('display-ads');
    expect(body.roots).toEqual([...GENERATED_ROOTS]);
    expect(Object.keys(body.files[0] ?? {}).sort()).toEqual([
      'modifiedAtMs',
      'path',
      'sizeBytes',
    ]);
  });

  it('informa el tamaño real de cada archivo', async () => {
    const body = await generatedBody();
    const script = body.files.find((file) => file.path === 'work/producer/script.txt');

    expect(script?.sizeBytes).toBe('[0:00] Hola'.length);
    expect(script?.modifiedAtMs).toBeGreaterThan(0);
  });

  it('devuelve una lista vacía cuando el motor todavía no produjo nada', async () => {
    const { deps } = dependencies([{ path: `${PROJECT_ROOT}/raw/aroll/screen.mp4`, contents: 'a' }]);
    const response = await handleGetGenerated(deps, STORE, { slug: 'display-ads' });

    expect((response.body as GeneratedBody).files).toEqual([]);
  });

  it('rechaza un slug que no es un segmento kebab-case', async () => {
    const { deps } = dependencies(SEED);

    await expect(handleGetGenerated(deps, STORE, { slug: '../etc' })).rejects.toMatchObject({
      code: 'PROJECT_SLUG_INVALID',
    });
  });

  it('rechaza un proyecto inexistente con PROJECT_NOT_FOUND', async () => {
    const { deps } = dependencies(SEED);

    await expect(handleGetGenerated(deps, STORE, { slug: 'missing' })).rejects.toMatchObject({
      code: 'PROJECT_NOT_FOUND',
    });
  });
});
