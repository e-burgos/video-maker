import type { MediaAsset } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../../__fixtures__/call-log';
import { createFakeObjectStorage } from '../../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../../__fixtures__/fake-render-api-dependencies';
import { requestLine } from '../../__fixtures__/http-request';
import type { StoreConfig } from '../../config/store-config';
import { createRenderApiRuntime } from '../render-api-runtime';
import {
  handleConfirmInboxAsset,
  handleDeleteInboxAsset,
  handleListInbox,
  handleUploadToInbox,
} from './asset-inbox-handler';

const STORE: StoreConfig = { mediaRoot: '/media', dbPath: '/media/.studio/studio.db', maxUploadBytes: 2_147_483_648, objectStore: 'fs' };
const SLUG = 'smoke-ingest';

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

function silentVideoAsset(assetId: string): MediaAsset {
  return {
    id: assetId,
    kind: 'video',
    path: assetId,
    durationMs: 8_000,
    fps: 30,
    width: 1920,
    height: 1080,
    hasAudio: false,
    probedAt: '2026-09-24T00:00:00.000Z',
  };
}

describe('handleUploadToInbox', () => {
  it('rejects an unsupported extension with UNSUPPORTED_MEDIA_TYPE before touching storage', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog);
    const runtime = createRenderApiRuntime(deps);
    const bytes = new TextEncoder().encode('hello');
    const request = uploadRequest(`/projects/${SLUG}/inbox/notes.txt`, bytes);

    await expect(
      handleUploadToInbox(deps, STORE, { slug: SLUG, filename: 'notes.txt' }, request, runtime),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_MEDIA_TYPE' });
    expect(callLog.ports()).toEqual([]);
  });

  it('rejects a non-portable filename with ASSET_PATH_INVALID', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog);
    const runtime = createRenderApiRuntime(deps);
    const bytes = new TextEncoder().encode('hello');
    const request = uploadRequest(`/projects/${SLUG}/inbox/..%2Fescape.mp4`, bytes);

    await expect(
      handleUploadToInbox(deps, STORE, { slug: SLUG, filename: '../escape.mp4' }, request, runtime),
    ).rejects.toMatchObject({ code: 'ASSET_PATH_INVALID' });
    expect(callLog.ports()).toEqual([]);
  });

  it('answers 411 without content-length and 400 without content-type', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog);
    const runtime = createRenderApiRuntime(deps);
    const bytes = new TextEncoder().encode('hello');

    const noLength = requestLine({
      method: 'PUT',
      path: `/projects/${SLUG}/inbox/clip.mp4`,
      headers: { 'content-type': 'video/mp4' },
      body: singleChunk(bytes),
    });
    await expect(
      handleUploadToInbox(deps, STORE, { slug: SLUG, filename: 'clip.mp4' }, noLength, runtime),
    ).rejects.toMatchObject({ code: 'ASSET_CONTENT_LENGTH_REQUIRED' });

    const noType = requestLine({
      method: 'PUT',
      path: `/projects/${SLUG}/inbox/clip.mp4`,
      headers: { 'content-length': String(bytes.length) },
      body: singleChunk(bytes),
    });
    await expect(
      handleUploadToInbox(deps, STORE, { slug: SLUG, filename: 'clip.mp4' }, noType, runtime),
    ).rejects.toMatchObject({ code: 'ASSET_CONTENT_TYPE_REQUIRED' });
  });

  it('answers 413 ASSET_TOO_LARGE from the content-length header before touching any port', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog);
    const runtime = createRenderApiRuntime(deps);
    const request = uploadRequest(`/projects/${SLUG}/inbox/clip.mp4`, new TextEncoder().encode('x'), {
      'content-length': String(STORE.maxUploadBytes + 1),
    });

    await expect(
      handleUploadToInbox(deps, STORE, { slug: SLUG, filename: 'clip.mp4' }, request, runtime),
    ).rejects.toMatchObject({ code: 'ASSET_TOO_LARGE' });
    expect(callLog.ports()).toEqual([]);
  });

  it('answers PROJECT_NOT_FOUND for a project that does not exist on disk', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog);
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const runtime = createRenderApiRuntime(deps);
    const bytes = new TextEncoder().encode('hello world');
    const request = uploadRequest(`/projects/${SLUG}/inbox/clip.mp4`, bytes);

    await expect(
      handleUploadToInbox(deps, STORE, { slug: SLUG, filename: 'clip.mp4' }, request, runtime),
    ).rejects.toMatchObject({ code: 'PROJECT_NOT_FOUND' });
  });

  it('stores a pending asset with the deterministic role proposal and answers 201', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [`${STORE.mediaRoot}/${SLUG}`] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const runtime = createRenderApiRuntime(deps);
    const bytes = new TextEncoder().encode('hello world');
    const request = uploadRequest(`/projects/${SLUG}/inbox/screen-recording.mp4`, bytes);

    const response = await handleUploadToInbox(deps, STORE, { slug: SLUG, filename: 'screen-recording.mp4' }, request, runtime);

    expect(response.status).toBe(201);
    expect(response.headers.location).toBe(`/projects/${SLUG}/files/raw/inbox/screen-recording.mp4`);
    const body = response.body as {
      asset: { id: string; fileName: string; path: string; proposedRole: string; proposalReason: string; status: string; probe: unknown };
    };
    expect(body.asset).toMatchObject({
      fileName: 'screen-recording.mp4',
      path: 'raw/inbox/screen-recording.mp4',
      proposedRole: 'aroll',
      proposalReason: 'has-audio',
      status: 'pending',
    });
    expect(body.asset.probe).toEqual({ kind: 'video', durationMs: 12_000, width: 1080, height: 1920, hasAudio: true });
    expect(typeof body.asset.id).toBe('string');

    const stored = deps.localStore.assets.get(body.asset.id);
    expect(stored).toMatchObject({ slug: SLUG, status: 'pending', proposedRole: 'aroll' });
    expect(await storage.stat(`${STORE.mediaRoot}/${SLUG}/raw/inbox/screen-recording.mp4`)).not.toBeNull();
  });

  it('suffixes the file name when the inbox already has one with the same name', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [`${STORE.mediaRoot}/${SLUG}`],
      files: [{ path: `${STORE.mediaRoot}/${SLUG}/raw/inbox/clip.mp4`, contents: 'existing' }],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const runtime = createRenderApiRuntime(deps);
    const bytes = new TextEncoder().encode('hello world');
    const request = uploadRequest(`/projects/${SLUG}/inbox/clip.mp4`, bytes);

    const response = await handleUploadToInbox(deps, STORE, { slug: SLUG, filename: 'clip.mp4' }, request, runtime);

    const body = response.body as { asset: { fileName: string; path: string } };
    expect(body.asset.fileName).toBe('clip-2.mp4');
    expect(body.asset.path).toBe('raw/inbox/clip-2.mp4');
  });

  it('proposes broll for a silent video and translates a probe failure', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [`${STORE.mediaRoot}/${SLUG}`] });
    const deps = createFakeRenderApiDependencies(callLog, {
      storage,
      probeAsset: async (input) => silentVideoAsset(input.assetId),
    });
    const runtime = createRenderApiRuntime(deps);
    const bytes = new TextEncoder().encode('hello world');
    const request = uploadRequest(`/projects/${SLUG}/inbox/quiet.mp4`, bytes);

    const response = await handleUploadToInbox(deps, STORE, { slug: SLUG, filename: 'quiet.mp4' }, request, runtime);
    const body = response.body as { asset: { proposedRole: string; proposalReason: string } };
    expect(body.asset).toMatchObject({ proposedRole: 'broll', proposalReason: 'no-audio' });
  });

  it('propagates a translated engine error when the probe fails, leaving the file in the inbox', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [`${STORE.mediaRoot}/${SLUG}`] });
    const deps = createFakeRenderApiDependencies(callLog, {
      storage,
      probeAsset: async () => {
        throw Object.assign(new Error('boom'), { code: 'COMMAND_FAILED' });
      },
    });
    const runtime = createRenderApiRuntime(deps);
    const bytes = new TextEncoder().encode('hello world');
    const request = uploadRequest(`/projects/${SLUG}/inbox/clip.mp4`, bytes);

    await expect(
      handleUploadToInbox(deps, STORE, { slug: SLUG, filename: 'clip.mp4' }, request, runtime),
    ).rejects.toMatchObject({ code: 'MEDIA_COMMAND_FAILED' });

    expect(await storage.stat(`${STORE.mediaRoot}/${SLUG}/raw/inbox/clip.mp4`)).not.toBeNull();
  });
});

describe('handleListInbox', () => {
  it('answers PROJECT_NOT_FOUND for a project that does not exist', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog);
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    await expect(handleListInbox(deps, STORE, { slug: SLUG })).rejects.toMatchObject({ code: 'PROJECT_NOT_FOUND' });
  });

  it('lists only pending assets for the project', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [`${STORE.mediaRoot}/${SLUG}`] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    deps.localStore.projects.insert(SLUG);
    deps.localStore.assets.insertPending({
      id: 'asset-1',
      slug: SLUG,
      path: 'raw/inbox/a.mp4',
      fileName: 'a.mp4',
      proposedRole: 'aroll',
      proposalReason: 'has-audio',
      probe: { kind: 'video', durationMs: 1000, hasAudio: true },
    });
    const confirmedRecord = deps.localStore.assets.insertPending({
      id: 'asset-2',
      slug: SLUG,
      path: 'raw/inbox/b.mp4',
      fileName: 'b.mp4',
      proposedRole: 'broll',
      proposalReason: 'no-audio',
      probe: {},
    });
    deps.localStore.assets.confirm(confirmedRecord.id, 'broll', 'raw/broll/b.mp4');

    const response = await handleListInbox(deps, STORE, { slug: SLUG });
    const body = response.body as { assets: readonly { id: string }[] };
    expect(body.assets.map((asset) => asset.id)).toEqual(['asset-1']);
  });
});

describe('handleConfirmInboxAsset', () => {
  function confirmRequest(role: string): ReturnType<typeof requestLine> {
    return requestLine({
      method: 'POST',
      path: `/projects/${SLUG}/inbox/asset-1/confirm`,
      headers: { 'content-type': 'application/json' },
      body: singleChunk(new TextEncoder().encode(JSON.stringify({ role }))),
    });
  }

  it('rejects an invalid role with ASSET_ROLE_INVALID', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog);
    const runtime = createRenderApiRuntime(deps);

    await expect(
      handleConfirmInboxAsset(deps, STORE, { slug: SLUG, assetId: 'asset-1' }, confirmRequest('video'), runtime),
    ).rejects.toMatchObject({ code: 'ASSET_ROLE_INVALID' });
  });

  it('answers INBOX_ASSET_NOT_FOUND for an unknown asset id', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [`${STORE.mediaRoot}/${SLUG}`] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const runtime = createRenderApiRuntime(deps);

    await expect(
      handleConfirmInboxAsset(deps, STORE, { slug: SLUG, assetId: 'missing' }, confirmRequest('aroll'), runtime),
    ).rejects.toMatchObject({ code: 'INBOX_ASSET_NOT_FOUND' });
  });

  it('answers INBOX_ASSET_NOT_FOUND for an asset already confirmed', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [`${STORE.mediaRoot}/${SLUG}`] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    deps.localStore.projects.insert(SLUG);
    deps.localStore.assets.insertPending({
      id: 'asset-1',
      slug: SLUG,
      path: 'raw/inbox/a.mp4',
      fileName: 'a.mp4',
      proposedRole: 'aroll',
      proposalReason: 'has-audio',
      probe: {},
    });
    deps.localStore.assets.confirm('asset-1', 'aroll', 'raw/aroll/a.mp4');
    const runtime = createRenderApiRuntime(deps);

    await expect(
      handleConfirmInboxAsset(deps, STORE, { slug: SLUG, assetId: 'asset-1' }, confirmRequest('aroll'), runtime),
    ).rejects.toMatchObject({ code: 'INBOX_ASSET_NOT_FOUND' });
  });

  it('moves the file to raw/<role>, updates the catalog and marks the asset confirmed', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [`${STORE.mediaRoot}/${SLUG}`],
      files: [{ path: `${STORE.mediaRoot}/${SLUG}/raw/inbox/a.mp4`, contents: 'bytes' }],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    deps.localStore.projects.insert(SLUG);
    deps.localStore.assets.insertPending({
      id: 'asset-1',
      slug: SLUG,
      path: 'raw/inbox/a.mp4',
      fileName: 'a.mp4',
      proposedRole: 'broll',
      proposalReason: 'no-audio',
      probe: {},
    });
    const runtime = createRenderApiRuntime(deps);

    const response = await handleConfirmInboxAsset(
      deps,
      STORE,
      { slug: SLUG, assetId: 'asset-1' },
      confirmRequest('aroll'),
      runtime,
    );

    expect(response.status).toBe(200);
    const body = response.body as { asset: { path: string; status: string; confirmedRole: string } };
    expect(body.asset).toMatchObject({ path: 'raw/aroll/a.mp4', status: 'confirmed', confirmedRole: 'aroll' });

    expect(await storage.stat(`${STORE.mediaRoot}/${SLUG}/raw/inbox/a.mp4`)).toBeNull();
    expect(await storage.stat(`${STORE.mediaRoot}/${SLUG}/raw/aroll/a.mp4`)).not.toBeNull();
    expect(deps.localStore.assets.get('asset-1')).toMatchObject({ status: 'confirmed', path: 'raw/aroll/a.mp4' });
    expect(callLog.ports()).toContain('probeAsset');
  });

  it('suffixes the destination file name when raw/<role> already has one with the same name', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [`${STORE.mediaRoot}/${SLUG}`],
      files: [
        { path: `${STORE.mediaRoot}/${SLUG}/raw/inbox/a.mp4`, contents: 'bytes' },
        { path: `${STORE.mediaRoot}/${SLUG}/raw/aroll/a.mp4`, contents: 'other bytes' },
      ],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    deps.localStore.projects.insert(SLUG);
    deps.localStore.assets.insertPending({
      id: 'asset-1',
      slug: SLUG,
      path: 'raw/inbox/a.mp4',
      fileName: 'a.mp4',
      proposedRole: 'aroll',
      proposalReason: 'has-audio',
      probe: {},
    });
    const runtime = createRenderApiRuntime(deps);

    const response = await handleConfirmInboxAsset(
      deps,
      STORE,
      { slug: SLUG, assetId: 'asset-1' },
      confirmRequest('aroll'),
      runtime,
    );

    const body = response.body as { asset: { path: string } };
    expect(body.asset.path).toBe('raw/aroll/a-2.mp4');
  });
});

describe('handleDeleteInboxAsset', () => {
  it('answers INBOX_ASSET_NOT_FOUND for an unknown asset id', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [`${STORE.mediaRoot}/${SLUG}`] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const runtime = createRenderApiRuntime(deps);

    await expect(
      handleDeleteInboxAsset(deps, STORE, { slug: SLUG, assetId: 'missing' }, runtime),
    ).rejects.toMatchObject({ code: 'INBOX_ASSET_NOT_FOUND' });
  });

  it('removes the file and the pending row', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [`${STORE.mediaRoot}/${SLUG}`],
      files: [{ path: `${STORE.mediaRoot}/${SLUG}/raw/inbox/a.mp4`, contents: 'bytes' }],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    deps.localStore.projects.insert(SLUG);
    deps.localStore.assets.insertPending({
      id: 'asset-1',
      slug: SLUG,
      path: 'raw/inbox/a.mp4',
      fileName: 'a.mp4',
      proposedRole: 'aroll',
      proposalReason: 'has-audio',
      probe: {},
    });
    const runtime = createRenderApiRuntime(deps);

    const response = await handleDeleteInboxAsset(deps, STORE, { slug: SLUG, assetId: 'asset-1' }, runtime);

    expect(response.status).toBe(200);
    expect(await storage.stat(`${STORE.mediaRoot}/${SLUG}/raw/inbox/a.mp4`)).toBeNull();
    expect(deps.localStore.assets.get('asset-1')).toBeNull();
  });
});
