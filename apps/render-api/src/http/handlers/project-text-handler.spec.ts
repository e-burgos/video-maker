import { STUDIO_TOOLS } from '@video-maker/producer-tools';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../../__fixtures__/call-log';
import { createFakeObjectStorage } from '../../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../../__fixtures__/fake-render-api-dependencies';
import { requestLine } from '../../__fixtures__/http-request';
import type { StoreConfig } from '../../config/store-config';
import { handleGetProjectText, handlePutProjectText } from './project-text-handler';

const STORE: StoreConfig = { mediaRoot: '/media', maxUploadBytes: 2_147_483_648, objectStore: 'fs' };
const PROJECT_ROOT = `${STORE.mediaRoot}/pitch-deck`;
const GET_TEXT_OUTPUT_KEYS = Object.keys(STUDIO_TOOLS.read_project_text.output.shape).sort();
const PUT_TEXT_OUTPUT_KEYS = Object.keys(STUDIO_TOOLS.write_project_text.output.shape).sort();

async function* toChunks(values: readonly string[]): AsyncGenerator<Uint8Array> {
  const encoder = new TextEncoder();
  for (const value of values) {
    yield encoder.encode(value);
  }
}

function getTextRequest(slug: string, path: string): ReturnType<typeof requestLine> {
  return requestLine({ method: 'GET', path: `/projects/${slug}/text?path=${encodeURIComponent(path)}` });
}

function putTextRequest(slug: string, payload: unknown): ReturnType<typeof requestLine> {
  return requestLine({
    method: 'PUT',
    path: `/projects/${slug}/text`,
    body: toChunks([JSON.stringify(payload)]),
  });
}

describe('handleGetProjectText', () => {
  it('answers 200 with exactly the read_project_text output keys', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [PROJECT_ROOT],
      files: [{ path: `${PROJECT_ROOT}/work/producer/notes.md`, contents: '# notes' }],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    const response = await handleGetProjectText(
      deps,
      STORE,
      { slug: 'pitch-deck' },
      getTextRequest('pitch-deck', 'work/producer/notes.md'),
    );

    expect(response.status).toBe(200);
    const body = response.body as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(GET_TEXT_OUTPUT_KEYS);
    expect(body).toEqual({ path: 'work/producer/notes.md', content: '# notes' });
  });

  it('rejects a missing path query parameter with 422 INVALID_INPUT', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    await expect(
      handleGetProjectText(deps, STORE, { slug: 'pitch-deck' }, requestLine({ method: 'GET', path: '/projects/pitch-deck/text' })),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('rejects a disallowed extension with 422 INVALID_INPUT', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [PROJECT_ROOT],
      files: [{ path: `${PROJECT_ROOT}/work/producer/notes.yaml`, contents: 'x' }],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    await expect(
      handleGetProjectText(deps, STORE, { slug: 'pitch-deck' }, getTextRequest('pitch-deck', 'work/producer/notes.yaml')),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('rejects a path outside work/ with 422 INVALID_INPUT', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [PROJECT_ROOT],
      files: [{ path: `${PROJECT_ROOT}/raw/aroll/notes.txt`, contents: 'x' }],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    await expect(
      handleGetProjectText(deps, STORE, { slug: 'pitch-deck' }, getTextRequest('pitch-deck', 'raw/aroll/notes.txt')),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('rejects an absolute path with 403 PATH_OUTSIDE_PROJECT', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    await expect(
      handleGetProjectText(deps, STORE, { slug: 'pitch-deck' }, getTextRequest('pitch-deck', '/etc/passwd')),
    ).rejects.toMatchObject({ code: 'PATH_OUTSIDE_PROJECT' });
  });

  it('rejects a path that does not exist with 404 FILE_NOT_FOUND', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    await expect(
      handleGetProjectText(deps, STORE, { slug: 'pitch-deck' }, getTextRequest('pitch-deck', 'work/producer/missing.md')),
    ).rejects.toMatchObject({ code: 'FILE_NOT_FOUND' });
  });

  it('rejects a file over the 256 KB limit with 413 FILE_TOO_LARGE', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [PROJECT_ROOT],
      files: [{ path: `${PROJECT_ROOT}/work/producer/huge.txt`, contents: 'x'.repeat(300 * 1024) }],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    await expect(
      handleGetProjectText(deps, STORE, { slug: 'pitch-deck' }, getTextRequest('pitch-deck', 'work/producer/huge.txt')),
    ).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });
  });
});

describe('handlePutProjectText', () => {
  it('answers 200 with exactly the write_project_text output keys and creates parent directories', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    const response = await handlePutProjectText(
      deps,
      STORE,
      { slug: 'pitch-deck' },
      putTextRequest('pitch-deck', { path: 'work/producer/notes.md', content: '# hello' }),
    );

    expect(response.status).toBe(200);
    const body = response.body as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(PUT_TEXT_OUTPUT_KEYS);
    expect(body).toEqual({ path: 'work/producer/notes.md', bytes: 7 });
    expect(callLog.ports()).toContain('ensureDirectory');
    expect(callLog.ports()).toContain('writeTextFile');
  });

  it('accepts exactly work/credits.json', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    const response = await handlePutProjectText(
      deps,
      STORE,
      { slug: 'pitch-deck' },
      putTextRequest('pitch-deck', { path: 'work/credits.json', content: '{}' }),
    );

    expect(response.status).toBe(200);
  });

  it('rejects a path under raw/ with 403 PATH_NOT_WRITABLE', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    await expect(
      handlePutProjectText(
        deps,
        STORE,
        { slug: 'pitch-deck' },
        putTextRequest('pitch-deck', { path: 'raw/aroll/notes.txt', content: 'x' }),
      ),
    ).rejects.toMatchObject({ code: 'PATH_NOT_WRITABLE' });
  });

  it('rejects work/timeline.json (under work/ but outside work/producer/) with 403 PATH_NOT_WRITABLE', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    await expect(
      handlePutProjectText(
        deps,
        STORE,
        { slug: 'pitch-deck' },
        putTextRequest('pitch-deck', { path: 'work/timeline.json', content: '{}' }),
      ),
    ).rejects.toMatchObject({ code: 'PATH_NOT_WRITABLE' });
  });

  it('rejects an absolute path with 403 PATH_OUTSIDE_PROJECT', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    await expect(
      handlePutProjectText(
        deps,
        STORE,
        { slug: 'pitch-deck' },
        putTextRequest('pitch-deck', { path: '/etc/passwd', content: 'x' }),
      ),
    ).rejects.toMatchObject({ code: 'PATH_OUTSIDE_PROJECT' });
  });

  it('rejects a non-string content with 422 INVALID_INPUT', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    await expect(
      handlePutProjectText(
        deps,
        STORE,
        { slug: 'pitch-deck' },
        putTextRequest('pitch-deck', { path: 'work/producer/notes.md', content: 42 }),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
});
