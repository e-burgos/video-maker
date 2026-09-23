import { describe, expect, it } from 'vitest';

import { createCallLog } from '../../__fixtures__/call-log';
import { createFakeRenderApiDependencies } from '../../__fixtures__/fake-render-api-dependencies';
import { requestLine } from '../../__fixtures__/http-request';
import { toErrorPayload } from '../../errors/to-error-payload';
import {
  handleCreateCategory,
  handleCreateFolder,
  handleDeleteCategory,
  handleDeleteFolder,
  handleListFolders,
  handleRenameFolder,
} from './folders-handler';

async function* textBody(text: string): AsyncGenerator<Uint8Array> {
  yield new TextEncoder().encode(text);
}

function jsonBody(value: unknown): AsyncGenerator<Uint8Array> {
  return textBody(JSON.stringify(value));
}

function fakeDeps() {
  const callLog = createCallLog();
  return { callLog, deps: createFakeRenderApiDependencies(callLog) };
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
    const { deps } = fakeDeps();

    const response = await handleListFolders(deps);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ folders: [], videos: {} });
  });
});

describe('handleCreateFolder', () => {
  it('creates the folder, answers 201 with its location and persists it', async () => {
    const { deps } = fakeDeps();

    const response = await handleCreateFolder(
      deps,
      undefined,
      requestLine({ method: 'POST', path: '/folders', body: jsonBody({ name: 'Display Ads' }) }),
    );

    expect(response.status).toBe(201);
    expect(response.headers['location']).toBe('/folders/display-ads');
    expect(response.body).toEqual({ id: 'display-ads', name: 'Display Ads', categories: [] });
    expect(deps.localStore.organization.getOrganization().folders).toHaveLength(1);
  });

  it('rejects a name that would leave no identifier behind', async () => {
    const { deps } = fakeDeps();

    const payload = await caughtErrorPayload(
      handleCreateFolder(
        deps,
        undefined,
        requestLine({ method: 'POST', path: '/folders', body: jsonBody({ name: '  ***  ' }) }),
      ),
    );

    expect(payload.code).toBe('FOLDER_NAME_INVALID');
  });

  it('rejects a body that carries no name', async () => {
    const { deps } = fakeDeps();

    const payload = await caughtErrorPayload(
      handleCreateFolder(
        deps,
        undefined,
        requestLine({ method: 'POST', path: '/folders', body: jsonBody({ title: 'Display Ads' }) }),
      ),
    );

    expect(payload.code).toBe('FOLDER_NAME_INVALID');
  });
});

describe('handleRenameFolder', () => {
  it('renames without touching the identifier', async () => {
    const { deps } = fakeDeps();
    deps.localStore.organization.createFolder('display-ads', 'Display Ads');

    const response = await handleRenameFolder(
      deps,
      { folderId: 'display-ads' },
      requestLine({ method: 'PUT', path: '/folders/display-ads', body: jsonBody({ name: 'Publicidad' }) }),
    );

    expect(response.body).toEqual({ id: 'display-ads', name: 'Publicidad', categories: [] });
  });

  it('answers 404 for a folder that does not exist', async () => {
    const { deps } = fakeDeps();

    const payload = await caughtErrorPayload(
      handleRenameFolder(
        deps,
        { folderId: 'ghost' },
        requestLine({ method: 'PUT', path: '/folders/ghost', body: jsonBody({ name: 'x' }) }),
      ),
    );

    expect(payload.code).toBe('FOLDER_NOT_FOUND');
  });
});

describe('handleDeleteFolder', () => {
  it('deletes the folder and frees its videos instead of losing them', async () => {
    const { deps } = fakeDeps();
    deps.localStore.projects.insert('editar-campana');
    deps.localStore.organization.createFolder('display-ads', 'Display Ads');
    deps.localStore.organization.setPlacement('editar-campana', {
      folderId: 'display-ads',
      categoryId: null,
      archived: false,
    });

    const response = await handleDeleteFolder(deps, { folderId: 'display-ads' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ folders: [], videos: {} });
  });
});

describe('categories', () => {
  it('creates a category inside its folder', async () => {
    const { deps } = fakeDeps();
    deps.localStore.organization.createFolder('display-ads', 'Display Ads');

    const response = await handleCreateCategory(
      deps,
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
    const { deps } = fakeDeps();
    deps.localStore.organization.createFolder('display-ads', 'Display Ads');

    const payload = await caughtErrorPayload(
      handleDeleteCategory(deps, { folderId: 'display-ads', categoryId: 'ghost' }),
    );

    expect(payload.code).toBe('FOLDER_CATEGORY_NOT_FOUND');
  });

  it('deletes the category and leaves its videos in the folder', async () => {
    const { deps } = fakeDeps();
    deps.localStore.projects.insert('editar-campana');
    deps.localStore.organization.createFolder('display-ads', 'Display Ads');
    deps.localStore.organization.createCategory('campanas', 'display-ads', 'Campañas');
    deps.localStore.organization.setPlacement('editar-campana', {
      folderId: 'display-ads',
      categoryId: 'campanas',
      archived: false,
    });

    const response = await handleDeleteCategory(deps, {
      folderId: 'display-ads',
      categoryId: 'campanas',
    });

    expect(response.body).toEqual({
      folders: [{ id: 'display-ads', name: 'Display Ads', categories: [] }],
      videos: { 'editar-campana': { folderId: 'display-ads', categoryId: null, archived: false } },
    });
  });
});
