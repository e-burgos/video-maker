import { describe, expect, it } from 'vitest';

import { createCallLog } from '../../__fixtures__/call-log';
import { createFakeObjectStorage } from '../../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../../__fixtures__/fake-render-api-dependencies';
import { requestLine } from '../../__fixtures__/http-request';
import type { StoreConfig } from '../../config/store-config';
import { voiceDirectionPath } from '../../voice/voice-paths';
import { handleGetVoiceDirection, handlePutVoiceDirection } from './voice-direction-handler';
import type { VoiceDirectionBody } from './voice-direction-handler';

const STORE: StoreConfig = { mediaRoot: '/var/data/media', dbPath: '/var/data/media/.studio/studio.db', maxUploadBytes: 2_147_483_648, objectStore: 'fs', motionAssetsRoot: '/repo/libs/motion-graphics/assets', brandsRoot: '/brands' };
const SLUG = 'acme-launch';
const PROJECT_ROOT = `${STORE.mediaRoot}/${SLUG}`;

function createDeps(files: readonly { path: string; contents: string }[] = []) {
  const callLog = createCallLog();
  const storage = createFakeObjectStorage(callLog, {
    directories: [PROJECT_ROOT],
    files: files.map((file) => ({ path: `${PROJECT_ROOT}/${file.path}`, contents: file.contents })),
  });
  return { deps: createFakeRenderApiDependencies(callLog, { storage }), storage };
}

async function* jsonBody(value: unknown): AsyncGenerator<Uint8Array> {
  yield new TextEncoder().encode(JSON.stringify(value));
}

describe('voice direction handlers (US-023-301, US-023-302)', () => {
  it('answers empty directions and no lines for a project without script', async () => {
    const { deps } = createDeps();

    const response = await handleGetVoiceDirection(deps, STORE, { slug: SLUG });
    const body = response.body as VoiceDirectionBody;

    expect(response.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(['directions', 'lines', 'path', 'slug']);
    expect(body).toMatchObject({ slug: SLUG, path: voiceDirectionPath(), directions: {}, lines: [] });
  });

  it('lists the producer script lines without time marks together with the stored directions', async () => {
    const { deps } = createDeps([
      { path: 'work/producer/script.txt', contents: '[0:00] Hola equipo.\n\nSegunda frase.\n' },
      { path: voiceDirectionPath(), contents: JSON.stringify({ '2': { pace: 'slow' } }) },
    ]);

    const body = (await handleGetVoiceDirection(deps, STORE, { slug: SLUG })).body as VoiceDirectionBody;

    expect(body.lines).toEqual([
      { index: 1, text: 'Hola equipo.' },
      { index: 2, text: 'Segunda frase.' },
    ]);
    expect(body.directions).toEqual({ '2': { pace: 'slow' } });
  });

  it('stores validated directions and echoes them back', async () => {
    const { deps, storage } = createDeps();
    const request = requestLine({ method: 'PUT', path: `/projects/${SLUG}/voice/direction`, body: jsonBody({ directions: { '1': { pace: 'fast', pauseAfterMs: 400 } } }) });

    const response = await handlePutVoiceDirection(deps, STORE, { slug: SLUG }, request);

    expect(response.status).toBe(200);
    expect(JSON.parse(await storage.readTextFile(`${PROJECT_ROOT}/${voiceDirectionPath()}`))).toEqual({ '1': { pace: 'fast', pauseAfterMs: 400 } });
    expect((response.body as VoiceDirectionBody).directions).toEqual({ '1': { pace: 'fast', pauseAfterMs: 400 } });
  });

  it.each([
    [{ directions: { '1': { pace: 'turbo' } } }],
    [{ directions: { zero: { pace: 'slow' } } }],
    [{}],
  ])('rejects an invalid body with INVALID_INPUT (%#)', async (payload) => {
    const { deps } = createDeps();
    const request = requestLine({ method: 'PUT', path: `/projects/${SLUG}/voice/direction`, body: jsonBody(payload) });

    await expect(handlePutVoiceDirection(deps, STORE, { slug: SLUG }, request)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
});
