import { describe, expect, it } from 'vitest';

import { createCallLog } from '../../__fixtures__/call-log';
import { createFakeObjectStorage } from '../../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../../__fixtures__/fake-render-api-dependencies';
import { requestLine } from '../../__fixtures__/http-request';
import type { StoreConfig } from '../../config/store-config';
import { handleGetArtifact } from './artifact-handler';

const STORE: StoreConfig = { mediaRoot: '/media', dbPath: '/media/.studio/studio.db', maxUploadBytes: 2_147_483_648, objectStore: 'fs', motionAssetsRoot: '/repo/libs/motion-graphics/assets' };

async function collectStream(stream: AsyncIterable<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of stream) {
    chunks.push(chunk);
    total += chunk.length;
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

describe('handleGetArtifact', () => {
  it('rejects a traversing, absolute or windows path with ASSET_PATH_INVALID before invoking any storage port', async () => {
    for (const path of ['../escape.mp4', '/etc/passwd', 'raw\\aroll\\clip.mp4']) {
      const callLog = createCallLog();
      const deps = createFakeRenderApiDependencies(callLog);
      const request = requestLine({ method: 'GET', path: `/projects/smoke-ingest/files/${path}` });

      await expect(
        handleGetArtifact(deps, STORE, { slug: 'smoke-ingest', path }, request),
      ).rejects.toMatchObject({ code: 'ASSET_PATH_INVALID' });
      expect(callLog.ports()).toEqual([]);
    }
  });

  it('answers 200 with content-length and accept-ranges when there is no Range header', async () => {
    const callLog = createCallLog();
    const contents = 'hello world';
    const storage = createFakeObjectStorage(callLog, {
      directories: [`${STORE.mediaRoot}/smoke-ingest`],
      files: [{ path: `${STORE.mediaRoot}/smoke-ingest/raw/aroll/clip01.mp4`, contents }],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const request = requestLine({ method: 'GET', path: '/projects/smoke-ingest/files/raw/aroll/clip01.mp4' });

    const response = await handleGetArtifact(
      deps,
      STORE,
      { slug: 'smoke-ingest', path: 'raw/aroll/clip01.mp4' },
      request,
    );

    expect(response.status).toBe(200);
    expect(response.headers['content-length']).toBe(String(contents.length));
    expect(response.headers['accept-ranges']).toBe('bytes');
  });

  it('answers 206 with content-range and exactly the requested bytes', async () => {
    const callLog = createCallLog();
    const contents = 'hello world';
    const storage = createFakeObjectStorage(callLog, {
      directories: [`${STORE.mediaRoot}/smoke-ingest`],
      files: [{ path: `${STORE.mediaRoot}/smoke-ingest/raw/aroll/clip01.mp4`, contents }],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const request = requestLine({
      method: 'GET',
      path: '/projects/smoke-ingest/files/raw/aroll/clip01.mp4',
      headers: { range: 'bytes=0-4' },
    });

    const response = await handleGetArtifact(
      deps,
      STORE,
      { slug: 'smoke-ingest', path: 'raw/aroll/clip01.mp4' },
      request,
    );

    expect(response.status).toBe(206);
    expect(response.headers['content-range']).toBe(`bytes 0-4/${contents.length}`);
    expect(response.headers['content-length']).toBe('5');

    if (response.stream === undefined) {
      throw new Error('expected a stream on the 206 response');
    }
    const bytes = await collectStream(response.stream());
    expect(new TextDecoder().decode(bytes)).toBe('hello');
  });

  it('answers 416 with content-range bytes */size for an unsatisfiable range', async () => {
    const callLog = createCallLog();
    const contents = 'hello world';
    const storage = createFakeObjectStorage(callLog, {
      directories: [`${STORE.mediaRoot}/smoke-ingest`],
      files: [{ path: `${STORE.mediaRoot}/smoke-ingest/raw/aroll/clip01.mp4`, contents }],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const request = requestLine({
      method: 'GET',
      path: '/projects/smoke-ingest/files/raw/aroll/clip01.mp4',
      headers: { range: 'bytes=999-1000' },
    });

    const response = await handleGetArtifact(
      deps,
      STORE,
      { slug: 'smoke-ingest', path: 'raw/aroll/clip01.mp4' },
      request,
    );

    expect(response.status).toBe(416);
    expect(response.headers['content-range']).toBe(`bytes */${contents.length}`);
  });

  it('serves the whole file with 200 for a malformed or multi-range header', async () => {
    const callLog = createCallLog();
    const contents = 'hello world';
    const storage = createFakeObjectStorage(callLog, {
      directories: [`${STORE.mediaRoot}/smoke-ingest`],
      files: [{ path: `${STORE.mediaRoot}/smoke-ingest/raw/aroll/clip01.mp4`, contents }],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    for (const rangeHeader of ['bytes=abc', 'bytes=0-10,20-30']) {
      const request = requestLine({
        method: 'GET',
        path: '/projects/smoke-ingest/files/raw/aroll/clip01.mp4',
        headers: { range: rangeHeader },
      });

      const response = await handleGetArtifact(
        deps,
        STORE,
        { slug: 'smoke-ingest', path: 'raw/aroll/clip01.mp4' },
        request,
      );
      expect(response.status).toBe(200);
      expect(response.headers['content-length']).toBe(String(contents.length));
    }
  });

  it('answers 404 ARTIFACT_NOT_FOUND for an absent path and for a directory', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [`${STORE.mediaRoot}/smoke-ingest`, `${STORE.mediaRoot}/smoke-ingest/raw`],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    const missingRequest = requestLine({
      method: 'GET',
      path: '/projects/smoke-ingest/files/raw/aroll/missing.mp4',
    });
    await expect(
      handleGetArtifact(
        deps,
        STORE,
        { slug: 'smoke-ingest', path: 'raw/aroll/missing.mp4' },
        missingRequest,
      ),
    ).rejects.toMatchObject({ code: 'ARTIFACT_NOT_FOUND' });

    const directoryRequest = requestLine({ method: 'GET', path: '/projects/smoke-ingest/files/raw' });
    await expect(
      handleGetArtifact(deps, STORE, { slug: 'smoke-ingest', path: 'raw' }, directoryRequest),
    ).rejects.toMatchObject({ code: 'ARTIFACT_NOT_FOUND' });
  });
});
