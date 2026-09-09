import { describe, expect, it } from 'vitest';

import { createCallLog } from '../../__fixtures__/call-log';
import { buildCatalogAssetFixture, buildCatalogFixture } from '../../__fixtures__/catalog-fixtures';
import { createFakeObjectStorage } from '../../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../../__fixtures__/fake-render-api-dependencies';
import { requestLine } from '../../__fixtures__/http-request';
import type { StoreConfig } from '../../config/store-config';
import { httpStatusFor } from '../../errors/http-status-for';
import type { RenderApiErrorCode } from '../../errors/render-api-error';
import { handleListAssets, handleUploadAsset } from './assets-handler';

const STORE: StoreConfig = { mediaRoot: '/media', maxUploadBytes: 2_147_483_648, objectStore: 'fs' };

async function* singleChunk(bytes: Uint8Array): AsyncGenerator<Uint8Array> {
  yield bytes;
}

function uploadRequest(
  path: string,
  bytes: Uint8Array,
  headerOverrides?: Readonly<Record<string, string>>,
): ReturnType<typeof requestLine> {
  return requestLine({
    method: 'PUT',
    path,
    headers: { 'content-length': String(bytes.length), 'content-type': 'video/mp4', ...headerOverrides },
    body: singleChunk(bytes),
  });
}

describe('handleListAssets', () => {
  it('answers 200 with source catalog and 200 with source raw-scan', async () => {
    const catalogCallLog = createCallLog();
    const catalogAsset = buildCatalogAssetFixture({ assetId: 'raw/aroll/clip01.mp4' });
    const catalog = buildCatalogFixture('smoke-ingest', [catalogAsset]);
    const catalogStorage = createFakeObjectStorage(catalogCallLog, {
      directories: [`${STORE.mediaRoot}/smoke-ingest`],
      files: [
        { path: `${STORE.mediaRoot}/smoke-ingest/work/catalog.json`, contents: JSON.stringify(catalog) },
      ],
    });
    const catalogDeps = createFakeRenderApiDependencies(catalogCallLog, { storage: catalogStorage });

    const catalogResponse = await handleListAssets(catalogDeps, STORE, { slug: 'smoke-ingest' });
    expect(catalogResponse.status).toBe(200);
    expect((catalogResponse.body as { source: string }).source).toBe('catalog');

    const rawCallLog = createCallLog();
    const rawStorage = createFakeObjectStorage(rawCallLog, {
      directories: [
        `${STORE.mediaRoot}/smoke-ingest`,
        `${STORE.mediaRoot}/smoke-ingest/raw`,
        `${STORE.mediaRoot}/smoke-ingest/raw/aroll`,
      ],
      files: [{ path: `${STORE.mediaRoot}/smoke-ingest/raw/aroll/clip02.mp4`, contents: 'bytes' }],
    });
    const rawDeps = createFakeRenderApiDependencies(rawCallLog, { storage: rawStorage });

    const rawResponse = await handleListAssets(rawDeps, STORE, { slug: 'smoke-ingest' });
    expect(rawResponse.status).toBe(200);
    expect((rawResponse.body as { source: string }).source).toBe('raw-scan');
  });

  it('answers 500 CATALOG_UNREADABLE for a corrupt catalog', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [`${STORE.mediaRoot}/smoke-ingest`],
      files: [{ path: `${STORE.mediaRoot}/smoke-ingest/work/catalog.json`, contents: 'not valid json' }],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    await expect(handleListAssets(deps, STORE, { slug: 'smoke-ingest' })).rejects.toMatchObject({
      code: 'CATALOG_UNREADABLE',
    });
  });

  it('answers 500 PROJECT_LAYOUT_INVALID when the raw directory is missing on a raw scan', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [`${STORE.mediaRoot}/smoke-ingest`],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    await expect(handleListAssets(deps, STORE, { slug: 'smoke-ingest' })).rejects.toMatchObject({
      code: 'PROJECT_LAYOUT_INVALID',
    });
  });
});

describe('handleUploadAsset', () => {
  it('rejects an invalid role with ASSET_ROLE_INVALID before invoking any storage port', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog);
    const bytes = new TextEncoder().encode('hello');
    const request = uploadRequest('/projects/smoke-ingest/assets/video/clip.mp4', bytes);

    await expect(
      handleUploadAsset(deps, STORE, { slug: 'smoke-ingest', role: 'video', filename: 'clip.mp4' }, request),
    ).rejects.toMatchObject({ code: 'ASSET_ROLE_INVALID' });
    expect(callLog.ports()).toEqual([]);
  });

  it('rejects ../escape.mp4 and sub/dir.mp4 with ASSET_PATH_INVALID before invoking any storage port', async () => {
    for (const filename of ['../escape.mp4', 'sub/dir.mp4']) {
      const callLog = createCallLog();
      const deps = createFakeRenderApiDependencies(callLog);
      const bytes = new TextEncoder().encode('hello');
      const request = uploadRequest(`/projects/smoke-ingest/assets/aroll/${filename}`, bytes);

      await expect(
        handleUploadAsset(deps, STORE, { slug: 'smoke-ingest', role: 'aroll', filename }, request),
      ).rejects.toMatchObject({ code: 'ASSET_PATH_INVALID' });
      expect(callLog.ports()).toEqual([]);
    }
  });

  it('writes to a temporary and promotes it, in that order', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [`${STORE.mediaRoot}/smoke-ingest`],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const bytes = new TextEncoder().encode('hello world');
    const request = uploadRequest('/projects/smoke-ingest/assets/aroll/clip01.mp4', bytes);

    const response = await handleUploadAsset(
      deps,
      STORE,
      { slug: 'smoke-ingest', role: 'aroll', filename: 'clip01.mp4' },
      request,
    );

    expect(response.status).toBe(201);
    expect(response.headers.location).toBe('/projects/smoke-ingest/files/raw/aroll/clip01.mp4');

    const ports = callLog.ports();
    const writeTemporaryIndex = ports.indexOf('writeTemporary');
    const promoteTemporaryIndex = ports.indexOf('promoteTemporary');
    expect(writeTemporaryIndex).toBeGreaterThanOrEqual(0);
    expect(promoteTemporaryIndex).toBeGreaterThan(writeTemporaryIndex);
    expect(ports.slice(writeTemporaryIndex, promoteTemporaryIndex + 1)).toEqual([
      'writeTemporary',
      'stat',
      'promoteTemporary',
    ]);
  });

  it('never promotes and leaves nothing at the destination when the write exceeds the limit', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [`${STORE.mediaRoot}/smoke-ingest`],
    });
    storage.control.queueWriteOutcome({ kind: 'limit-exceeded', limitBytes: 5 });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const bytes = new TextEncoder().encode('hello world');
    const request = uploadRequest('/projects/smoke-ingest/assets/aroll/clip01.mp4', bytes);

    await expect(
      handleUploadAsset(deps, STORE, { slug: 'smoke-ingest', role: 'aroll', filename: 'clip01.mp4' }, request),
    ).rejects.toMatchObject({ code: 'ASSET_TOO_LARGE' });

    expect(callLog.ports()).not.toContain('promoteTemporary');
    expect(await storage.stat(`${STORE.mediaRoot}/smoke-ingest/raw/aroll/clip01.mp4`)).toBeNull();
  });

  it('never promotes and answers ASSET_UPLOAD_ABORTED when the source stream is cut', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [`${STORE.mediaRoot}/smoke-ingest`],
    });
    storage.control.queueWriteOutcome({ kind: 'aborted' });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const bytes = new TextEncoder().encode('hello world');
    const request = uploadRequest('/projects/smoke-ingest/assets/aroll/clip01.mp4', bytes);

    await expect(
      handleUploadAsset(deps, STORE, { slug: 'smoke-ingest', role: 'aroll', filename: 'clip01.mp4' }, request),
    ).rejects.toMatchObject({ code: 'ASSET_UPLOAD_ABORTED' });

    expect(callLog.ports()).not.toContain('promoteTemporary');
    expect(await storage.stat(`${STORE.mediaRoot}/smoke-ingest/raw/aroll/clip01.mp4`)).toBeNull();
  });

  it('removes the temporary and answers ASSET_ALREADY_EXISTS when the destination appears before the promotion', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [`${STORE.mediaRoot}/smoke-ingest`],
    });
    const destination = `${STORE.mediaRoot}/smoke-ingest/raw/aroll/clip01.mp4`;
    storage.control.queueStat(destination, null, { kind: 'file', sizeBytes: 1, modifiedAtMs: 0 });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const bytes = new TextEncoder().encode('hello world');
    const request = uploadRequest('/projects/smoke-ingest/assets/aroll/clip01.mp4', bytes);

    await expect(
      handleUploadAsset(deps, STORE, { slug: 'smoke-ingest', role: 'aroll', filename: 'clip01.mp4' }, request),
    ).rejects.toMatchObject({ code: 'ASSET_ALREADY_EXISTS' });

    expect(callLog.ports()).toContain('removeTemporary');
    expect(callLog.ports()).not.toContain('promoteTemporary');
  });

  it('writes a catalog containing the uploaded asset next to the pre-existing ones', async () => {
    const callLog = createCallLog();
    const existingAsset = buildCatalogAssetFixture({ assetId: 'raw/aroll/existing.mp4' });
    const existingCatalog = buildCatalogFixture('smoke-ingest', [existingAsset]);
    const storage = createFakeObjectStorage(callLog, {
      directories: [`${STORE.mediaRoot}/smoke-ingest`],
      files: [
        {
          path: `${STORE.mediaRoot}/smoke-ingest/work/catalog.json`,
          contents: JSON.stringify(existingCatalog),
        },
      ],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const bytes = new TextEncoder().encode('hello world');
    const request = uploadRequest('/projects/smoke-ingest/assets/broll/new.mp4', bytes);

    const response = await handleUploadAsset(
      deps,
      STORE,
      { slug: 'smoke-ingest', role: 'broll', filename: 'new.mp4' },
      request,
    );

    expect(Object.keys(response.body as object).sort()).toEqual(['fingerprint', 'media', 'path', 'role']);

    const writeCall = callLog
      .entries()
      .find(
        (entry) =>
          entry.port === 'writeTextFile' &&
          (entry.input as { path: string }).path === `${STORE.mediaRoot}/smoke-ingest/work/catalog.json`,
      );
    if (writeCall === undefined) {
      throw new Error('expected a writeTextFile call for work/catalog.json');
    }
    const writtenCatalog = JSON.parse((writeCall.input as { contents: string }).contents) as {
      assets: readonly { asset: { id: string } }[];
    };
    expect(writtenCatalog.assets.map((entry) => entry.asset.id)).toEqual([
      'raw/aroll/existing.mp4',
      'raw/broll/new.mp4',
    ]);
  });

  it('answers CATALOG_UNREADABLE with assetPersisted true and catalogUpdated false when the catalog is corrupt', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [`${STORE.mediaRoot}/smoke-ingest`],
      files: [{ path: `${STORE.mediaRoot}/smoke-ingest/work/catalog.json`, contents: 'not valid json' }],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const bytes = new TextEncoder().encode('hello world');
    const request = uploadRequest('/projects/smoke-ingest/assets/aroll/clip01.mp4', bytes);

    await expect(
      handleUploadAsset(deps, STORE, { slug: 'smoke-ingest', role: 'aroll', filename: 'clip01.mp4' }, request),
    ).rejects.toMatchObject({
      code: 'CATALOG_UNREADABLE',
      details: { assetPersisted: true, catalogUpdated: false },
    });

    expect(callLog.ports()).not.toContain('probeAsset');
    expect(await storage.stat(`${STORE.mediaRoot}/smoke-ingest/raw/aroll/clip01.mp4`)).not.toBeNull();
  });

  it('keeps the asset written and records the probe failure when probeAsset fails', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [`${STORE.mediaRoot}/smoke-ingest`],
    });
    const deps = createFakeRenderApiDependencies(callLog, {
      storage,
      probeAsset: async () => {
        throw Object.assign(new Error('/opt/homebrew/bin/ffmpeg exited with code 1'), {
          code: 'COMMAND_FAILED',
        });
      },
    });
    const bytes = new TextEncoder().encode('hello world');
    const request = uploadRequest('/projects/smoke-ingest/assets/aroll/clip01.mp4', bytes);

    await expect(
      handleUploadAsset(deps, STORE, { slug: 'smoke-ingest', role: 'aroll', filename: 'clip01.mp4' }, request),
    ).rejects.toMatchObject({
      code: 'MEDIA_COMMAND_FAILED',
      details: { assetPersisted: true, catalogUpdated: true },
    });

    expect(callLog.ports()).not.toContain('removeTemporary');
    expect(await storage.stat(`${STORE.mediaRoot}/smoke-ingest/raw/aroll/clip01.mp4`)).not.toBeNull();
  });

  const PROBE_FAILURE_CASES: readonly { readonly errorCode: string; readonly ownCode: string; readonly status: number }[] =
    [
      { errorCode: 'BINARY_NOT_FOUND', ownCode: 'MEDIA_BINARY_NOT_FOUND', status: 503 },
      { errorCode: 'COMMAND_FAILED', ownCode: 'MEDIA_COMMAND_FAILED', status: 500 },
      { errorCode: 'UNPARSEABLE_OUTPUT', ownCode: 'MEDIA_OUTPUT_UNPARSEABLE', status: 500 },
    ];

  it.each(PROBE_FAILURE_CASES)(
    'answers $status $ownCode with assetPersisted and catalogUpdated true',
    async ({ errorCode, ownCode, status }) => {
      const callLog = createCallLog();
      const storage = createFakeObjectStorage(callLog, {
        directories: [`${STORE.mediaRoot}/smoke-ingest`],
      });
      const deps = createFakeRenderApiDependencies(callLog, {
        storage,
        probeAsset: async () => {
          throw Object.assign(new Error('boom'), { code: errorCode });
        },
      });
      const bytes = new TextEncoder().encode('hello world');
      const request = uploadRequest('/projects/smoke-ingest/assets/aroll/clip01.mp4', bytes);

      await expect(
        handleUploadAsset(deps, STORE, { slug: 'smoke-ingest', role: 'aroll', filename: 'clip01.mp4' }, request),
      ).rejects.toMatchObject({
        code: ownCode,
        details: { assetPersisted: true, catalogUpdated: true },
      });
      expect(httpStatusFor(ownCode as RenderApiErrorCode)).toBe(status);
    },
  );

  it('answers 411 without content-length and 400 without content-type', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog);
    const bytes = new TextEncoder().encode('hello');

    const noLengthRequest = requestLine({
      method: 'PUT',
      path: '/projects/smoke-ingest/assets/aroll/clip01.mp4',
      headers: { 'content-type': 'video/mp4' },
      body: singleChunk(bytes),
    });
    await expect(
      handleUploadAsset(
        deps,
        STORE,
        { slug: 'smoke-ingest', role: 'aroll', filename: 'clip01.mp4' },
        noLengthRequest,
      ),
    ).rejects.toMatchObject({ code: 'ASSET_CONTENT_LENGTH_REQUIRED' });

    const noTypeRequest = requestLine({
      method: 'PUT',
      path: '/projects/smoke-ingest/assets/aroll/clip01.mp4',
      headers: { 'content-length': String(bytes.length) },
      body: singleChunk(bytes),
    });
    await expect(
      handleUploadAsset(
        deps,
        STORE,
        { slug: 'smoke-ingest', role: 'aroll', filename: 'clip01.mp4' },
        noTypeRequest,
      ),
    ).rejects.toMatchObject({ code: 'ASSET_CONTENT_TYPE_REQUIRED' });
  });

  it('answers 413 ASSET_TOO_LARGE from the content-length header before touching any port', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog);
    const request = uploadRequest(
      '/projects/smoke-ingest/assets/aroll/clip01.mp4',
      new TextEncoder().encode('x'),
      { 'content-length': String(STORE.maxUploadBytes + 1) },
    );

    await expect(
      handleUploadAsset(deps, STORE, { slug: 'smoke-ingest', role: 'aroll', filename: 'clip01.mp4' }, request),
    ).rejects.toMatchObject({ code: 'ASSET_TOO_LARGE' });
    expect(callLog.ports()).toEqual([]);
  });

  it('answers 409 ASSET_ALREADY_EXISTS without writing when the destination exists', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [`${STORE.mediaRoot}/smoke-ingest`],
      files: [{ path: `${STORE.mediaRoot}/smoke-ingest/raw/aroll/clip01.mp4`, contents: 'existing bytes' }],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const bytes = new TextEncoder().encode('hello world');
    const request = uploadRequest('/projects/smoke-ingest/assets/aroll/clip01.mp4', bytes);

    await expect(
      handleUploadAsset(deps, STORE, { slug: 'smoke-ingest', role: 'aroll', filename: 'clip01.mp4' }, request),
    ).rejects.toMatchObject({ code: 'ASSET_ALREADY_EXISTS' });
    expect(callLog.ports()).not.toContain('writeTemporary');
  });
});
