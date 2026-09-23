import { serializeMontageDocument } from '@video-maker/auto-montage';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../../__fixtures__/call-log';
import type { FakeObjectStorageSeed } from '../../__fixtures__/fake-object-storage';
import { createFakeObjectStorage } from '../../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../../__fixtures__/fake-render-api-dependencies';
import { requestLine } from '../../__fixtures__/http-request';
import { buildStoryboardDocument } from '../../__fixtures__/storyboard-fixtures';
import type { StoreConfig } from '../../config/store-config';
import type { HttpRequestLine } from '../http-message';
import {
  handleGetStoryboard,
  handleGetStoryboardPrompts,
  handlePutStoryboard,
} from './storyboard-handler';

const STORE: StoreConfig = { mediaRoot: '/media', dbPath: '/media/.studio/studio.db', maxUploadBytes: 2_147_483_648, objectStore: 'fs' };
const SLUG = 'acme-launch';
const STORYBOARD_ABSOLUTE = `${STORE.mediaRoot}/${SLUG}/work/storyboard.json`;

const STORYBOARD_WRITE_KEYS = ['slug', 'path'].sort();

async function* toChunks(values: readonly string[]): AsyncGenerator<Uint8Array> {
  const encoder = new TextEncoder();
  for (const value of values) {
    yield encoder.encode(value);
  }
}

function putRequest(raw: string): HttpRequestLine {
  return requestLine({ method: 'PUT', path: `/projects/${SLUG}/storyboard`, body: toChunks([raw]) });
}

function harness(seed?: FakeObjectStorageSeed) {
  const callLog = createCallLog();
  const storage = createFakeObjectStorage(callLog, {
    directories: [`${STORE.mediaRoot}/${SLUG}`, `${STORE.mediaRoot}/${SLUG}/work`],
    ...(seed ?? {}),
  });
  return { storage, deps: createFakeRenderApiDependencies(callLog, { storage }) };
}

function seededWithStoryboard() {
  return harness({
    files: [{ path: STORYBOARD_ABSOLUTE, contents: serializeMontageDocument(buildStoryboardDocument()) }],
  });
}

describe('handleGetStoryboard', () => {
  it('devuelve el documento persistido tal cual', async () => {
    const { deps } = seededWithStoryboard();

    const response = await handleGetStoryboard(deps, STORE, { slug: SLUG });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
    expect(response.body).toEqual(buildStoryboardDocument());
  });

  it('responde STORYBOARD_NOT_FOUND cuando el proyecto no tiene storyboard', async () => {
    const { deps } = harness();

    await expect(handleGetStoryboard(deps, STORE, { slug: SLUG })).rejects.toMatchObject({
      code: 'STORYBOARD_NOT_FOUND',
      resource: 'work/storyboard.json',
    });
  });

  it.each([
    ['PROJECT_SLUG_INVALID', 'Not_A_Slug'],
    ['PROJECT_NOT_FOUND', 'missing-project'],
  ])('responde %s antes de leer nada', async (code, slug) => {
    const { deps } = harness();

    await expect(handleGetStoryboard(deps, STORE, { slug })).rejects.toMatchObject({ code });
  });
});

describe('handlePutStoryboard', () => {
  it('persiste el documento y devuelve el set completo de claves declarado', async () => {
    const { deps, storage } = harness();
    const document = buildStoryboardDocument();

    const response = await handlePutStoryboard(deps, STORE, { slug: SLUG }, putRequest(JSON.stringify(document)));

    expect(response.status).toBe(200);
    expect(Object.keys(response.body as object).sort()).toEqual(STORYBOARD_WRITE_KEYS);
    expect(response.body).toEqual({ slug: SLUG, path: 'work/storyboard.json' });
    expect(await storage.readTextFile(STORYBOARD_ABSOLUTE)).toBe(serializeMontageDocument(document));
  });

  it('rechaza un documento que no valida sin tocar el disco', async () => {
    const { deps, storage } = harness();

    await expect(
      handlePutStoryboard(deps, STORE, { slug: SLUG }, putRequest(JSON.stringify({ schemaVersion: 1 }))),
    ).rejects.toMatchObject({ code: 'STORYBOARD_INVALID' });
    expect(await storage.stat(STORYBOARD_ABSOLUTE)).toBeNull();
  });

  it.each([
    ['un body vacío', ''],
    ['un body que no es JSON', '{ roto'],
  ])('rechaza %s con REQUEST_BODY_INVALID_JSON', async (_title, raw) => {
    const { deps } = harness();

    await expect(handlePutStoryboard(deps, STORE, { slug: SLUG }, putRequest(raw))).rejects.toMatchObject({
      code: 'REQUEST_BODY_INVALID_JSON',
    });
  });

  it('valida el documento antes de resolver el proyecto', async () => {
    const { deps } = harness();

    await expect(
      handlePutStoryboard(deps, STORE, { slug: 'missing-project' }, putRequest(JSON.stringify({ nope: true }))),
    ).rejects.toMatchObject({ code: 'STORYBOARD_INVALID' });
  });
});

describe('handleGetStoryboardPrompts', () => {
  it('devuelve texto plano numerado, con content-length y stream propio', async () => {
    const { deps } = seededWithStoryboard();

    const response = await handleGetStoryboardPrompts(deps, STORE, { slug: SLUG });
    const text = response.body as string;

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('text/plain; charset=utf-8');
    expect(response.headers['content-length']).toBe(String(new TextEncoder().encode(text).byteLength));
    expect(text).toContain('01. [upload');
    expect(text).toContain('## Characters');
  });

  it('emite por el stream exactamente los mismos bytes que el body', async () => {
    const { deps } = seededWithStoryboard();

    const response = await handleGetStoryboardPrompts(deps, STORE, { slug: SLUG });
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.stream?.() ?? []) {
      chunks.push(chunk);
    }
    const streamed = new TextDecoder().decode(
      Uint8Array.from(chunks.flatMap((chunk) => Array.from(chunk))),
    );

    expect(streamed).toBe(response.body as string);
  });

  it('responde STORYBOARD_NOT_FOUND cuando no hay documento del que exportar prompts', async () => {
    const { deps } = harness();

    await expect(handleGetStoryboardPrompts(deps, STORE, { slug: SLUG })).rejects.toMatchObject({
      code: 'STORYBOARD_NOT_FOUND',
    });
  });
});
