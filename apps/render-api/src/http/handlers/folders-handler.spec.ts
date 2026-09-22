import { describe, expect, it } from 'vitest';

import { createCallLog } from '../../__fixtures__/call-log';
import { createFakeObjectStorage } from '../../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../../__fixtures__/fake-render-api-dependencies';
import { requestLine } from '../../__fixtures__/http-request';
import type { StoreConfig } from '../../config/store-config';
import { toErrorPayload } from '../../errors/to-error-payload';
import { organizationPath } from '../../store/organization-store';
import {
  handleCreateCategory,
  handleCreateFolder,
  handleDeleteCategory,
  handleDeleteFolder,
  handleListFolders,
  handleRenameFolder,
} from './folders-handler';

const STORE: StoreConfig = { mediaRoot: '/media', maxUploadBytes: 2_147_483_648, objectStore: 'fs' };

async function* textBody(text: string): AsyncGenerator<Uint8Array> {
  yield new TextEncoder().encode(text);
}

function jsonBody(value: unknown): AsyncGenerator<Uint8Array> {
  return textBody(JSON.stringify(value));
}

function seededStorage(organization: unknown) {
  const callLog = createCallLog();
  const storage = createFakeObjectStorage(callLog, {
    files: [{ path: organizationPath(STORE.mediaRoot), contents: JSON.stringify(organization) }],
  });
  return { callLog, storage, deps: createFakeRenderApiDependencies(callLog, { storage }) };
}

async function caughtErrorPayload(promise: Promise<unknown>): Promise<ReturnType<typeof toErrorPayload>> {
  return promise.then(
    () => {
      throw new Error('expected the handler to reject');
    },
    (error: unknown) => toErrorPayload(error),
  );
}

describe('handleListFolders', () => {
  it('answers an empty organization on a media root that was never organized', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog);
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    const response = await handleListFolders(deps, STORE);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ folders: [], videos: {} });
  });
});

describe('handleCreateFolder', () => {
  it('creates the folder, answers 201 with its location and persists it', async () => {
    const { deps, storage } = seededStorage({ folders: [], videos: {} });

    const response = await handleCreateFolder(
      deps,
      STORE,
      undefined,
      requestLine({ method: 'POST', path: '/folders', body: jsonBody({ name: 'Display Ads' }) }),
    );

    expect(response.status).toBe(201);
    expect(response.headers['location']).toBe('/folders/display-ads');
    expect(response.body).toEqual({ id: 'display-ads', name: 'Display Ads', categories: [] });

    const stored = JSON.parse(await storage.readTextFile(organizationPath(STORE.mediaRoot))) as {
      folders: unknown[];
    };
    expect(stored.folders).toHaveLength(1);
  });

  it('rejects a name that would leave no identifier behind', async () => {
    const { deps } = seededStorage({ folders: [], videos: {} });

    const payload = await caughtErrorPayload(
      handleCreateFolder(
        deps,
        STORE,
        undefined,
        requestLine({ method: 'POST', path: '/folders', body: jsonBody({ name: '  ***  ' }) }),
      ),
    );

    expect(payload.code).toBe('FOLDER_NAME_INVALID');
  });

  it('rejects a body that carries no name', async () => {
    const { deps } = seededStorage({ folders: [], videos: {} });

    const payload = await caughtErrorPayload(
      handleCreateFolder(
        deps,
        STORE,
        undefined,
        requestLine({ method: 'POST', path: '/folders', body: jsonBody({ title: 'Display Ads' }) }),
      ),
    );

    expect(payload.code).toBe('FOLDER_NAME_INVALID');
  });
});

describe('handleRenameFolder', () => {
  it('renames without touching the identifier', async () => {
    const { deps } = seededStorage({
      folders: [{ id: 'display-ads', name: 'Display Ads', categories: [] }],
      videos: {},
    });

    const response = await handleRenameFolder(
      deps,
      STORE,
      { folderId: 'display-ads' },
      requestLine({ method: 'PUT', path: '/folders/display-ads', body: jsonBody({ name: 'Publicidad' }) }),
    );

    expect(response.body).toEqual({ id: 'display-ads', name: 'Publicidad', categories: [] });
  });

  it('answers 404 for a folder that does not exist', async () => {
    const { deps } = seededStorage({ folders: [], videos: {} });

    const payload = await caughtErrorPayload(
      handleRenameFolder(
        deps,
        STORE,
        { folderId: 'ghost' },
        requestLine({ method: 'PUT', path: '/folders/ghost', body: jsonBody({ name: 'x' }) }),
      ),
    );

    expect(payload.code).toBe('FOLDER_NOT_FOUND');
  });
});

describe('handleDeleteFolder', () => {
  it('deletes the folder and frees its videos instead of losing them', async () => {
    const { deps } = seededStorage({
      folders: [{ id: 'display-ads', name: 'Display Ads', categories: [] }],
      videos: { 'editar-campana': { folderId: 'display-ads', categoryId: null, archived: false } },
    });

    const response = await handleDeleteFolder(deps, STORE, { folderId: 'display-ads' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ folders: [], videos: {} });
  });
});

describe('categories', () => {
  it('creates a category inside its folder', async () => {
    const { deps } = seededStorage({
      folders: [{ id: 'display-ads', name: 'Display Ads', categories: [] }],
      videos: {},
    });

    const response = await handleCreateCategory(
      deps,
      STORE,
      { folderId: 'display-ads' },
      requestLine({
        method: 'POST',
        path: '/folders/display-ads/categories',
        body: jsonBody({ name: 'Campañas' }),
      }),
    );

    expect(response.status).toBe(201);
    expect(response.headers['location']).toBe('/folders/display-ads/categories/campanas');
    expect(response.body).toEqual({ id: 'campanas', name: 'Campañas' });
  });

  it('answers 404 when the category to delete is not in that folder', async () => {
    const { deps } = seededStorage({
      folders: [{ id: 'display-ads', name: 'Display Ads', categories: [] }],
      videos: {},
    });

    const payload = await caughtErrorPayload(
      handleDeleteCategory(deps, STORE, { folderId: 'display-ads', categoryId: 'ghost' }),
    );

    expect(payload.code).toBe('FOLDER_CATEGORY_NOT_FOUND');
  });

  it('deletes the category and leaves its videos in the folder', async () => {
    const { deps } = seededStorage({
      folders: [
        { id: 'display-ads', name: 'Display Ads', categories: [{ id: 'campanas', name: 'Campañas' }] },
      ],
      videos: { 'editar-campana': { folderId: 'display-ads', categoryId: 'campanas', archived: false } },
    });

    const response = await handleDeleteCategory(deps, STORE, {
      folderId: 'display-ads',
      categoryId: 'campanas',
    });

    expect(response.body).toEqual({
      folders: [{ id: 'display-ads', name: 'Display Ads', categories: [] }],
      videos: { 'editar-campana': { folderId: 'display-ads', categoryId: null, archived: false } },
    });
  });
});
