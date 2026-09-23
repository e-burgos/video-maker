import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeObjectStorage } from '../__fixtures__/fake-object-storage';
import type { FakeObjectStorageFileSeed } from '../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import type { StoreConfig } from '../config/store-config';
import { organizationPath } from './organization-store';
import { importLegacyMedia } from './import-legacy-media';

const STORE: StoreConfig = {
  mediaRoot: '/media',
  dbPath: '/media/.studio/studio.db',
  maxUploadBytes: 2_147_483_648,
  objectStore: 'fs',
};

const WRITE_PORTS = ['writeTextFile', 'ensureDirectory', 'writeTemporary', 'promoteTemporary', 'removeTemporary', 'removeFile', 'removeDirectory'];

const ORGANIZATION_WITH_DUPLICATE_CATEGORY_IDS = {
  folders: [
    {
      id: 'clients',
      name: 'Clients',
      categories: [{ id: 'intro', name: 'Intro' }],
    },
    {
      id: 'archive',
      name: 'Archive',
      categories: [{ id: 'intro', name: 'Intro (archived)' }],
    },
  ],
  videos: {
    'project-a': { folderId: 'clients', categoryId: 'intro', archived: false },
    'project-b': { folderId: 'archive', categoryId: 'intro', archived: false },
    'project-ghost': { folderId: 'clients', categoryId: 'intro', archived: false },
  },
};

const CONVERSATION = {
  messages: [
    {
      id: 'msg-0001',
      role: 'user',
      text: 'hola',
      createdAt: '2026-09-10T10:00:00.000Z',
      turnId: 'turn-0001',
    },
    {
      id: 'msg-0002',
      role: 'assistant',
      text: 'buenas',
      createdAt: '2026-09-10T10:00:30.000Z',
      turnId: 'turn-0001',
      model: 'sonnet',
      suggestions: ['Proponé un guion'],
    },
  ],
};

const SESSION = {
  sessionId: '11111111-2222-3333-4444-555555555555',
  model: 'sonnet',
  createdAt: '2026-09-10T10:00:00.000Z',
  lastTurnAt: '2026-09-10T10:00:30.000Z',
};

function seed(files: readonly FakeObjectStorageFileSeed[], directories: readonly string[]) {
  const callLog = createCallLog();
  const storage = createFakeObjectStorage(callLog, { directories, files });
  const deps = createFakeRenderApiDependencies(callLog, { storage });
  return { callLog, storage, deps };
}

function baseDirectories(...slugs: readonly string[]): readonly string[] {
  return [
    `${STORE.mediaRoot}`,
    ...slugs.map((slug) => `${STORE.mediaRoot}/${slug}`),
  ];
}

describe('importLegacyMedia', () => {
  it('imports every project directory that does not have a row yet', async () => {
    const { deps } = seed(
      [],
      [
        `${STORE.mediaRoot}/project-a`,
        `${STORE.mediaRoot}/project-b`,
        `${STORE.mediaRoot}/.studio`,
        `${STORE.mediaRoot}/_library`,
        `${STORE.mediaRoot}/Not_Valid`,
      ],
    );

    const report = await importLegacyMedia(deps, STORE);

    expect(report.projectsImported).toBe(2);
    expect(deps.localStore.projects.list().map((record) => record.slug)).toEqual(['project-a', 'project-b']);
    expect(deps.localStore.projects.get('project-a')?.importedAt).not.toBeNull();
    expect(deps.localStore.projects.exists('.studio')).toBe(false);
    expect(deps.localStore.projects.exists('_library')).toBe(false);
  });

  it('does not import a project directory that already has a row', async () => {
    const { deps } = seed([], [`${STORE.mediaRoot}/project-a`]);
    deps.localStore.projects.insert('project-a');

    const report = await importLegacyMedia(deps, STORE);

    expect(report.projectsImported).toBe(0);
    expect(deps.localStore.projects.list()).toHaveLength(1);
  });

  it('imports organization.json, dedupes a category id that collides across folders, and remaps only the placement that pointed at the duplicate', async () => {
    const { deps } = seed(
      [{ path: organizationPath(STORE.mediaRoot), contents: JSON.stringify(ORGANIZATION_WITH_DUPLICATE_CATEGORY_IDS) }],
      baseDirectories('project-a', 'project-b'),
    );

    const report = await importLegacyMedia(deps, STORE);

    expect(report.organizationImported).toBe(true);
    const organization = deps.localStore.organization.getOrganization();
    expect(organization.folders.map((folder) => folder.id)).toEqual(['clients', 'archive']);

    const clientsCategoryIds = organization.folders.find((folder) => folder.id === 'clients')?.categories.map((category) => category.id);
    const archiveCategoryIds = organization.folders.find((folder) => folder.id === 'archive')?.categories.map((category) => category.id);
    expect(clientsCategoryIds).toEqual(['intro']);
    expect(archiveCategoryIds).toEqual(['intro-2']);

    expect(organization.videos['project-a']).toEqual({ folderId: 'clients', categoryId: 'intro', archived: false });
    expect(organization.videos['project-b']).toEqual({ folderId: 'archive', categoryId: 'intro-2', archived: false });
    expect(organization.videos['project-ghost']).toBeUndefined();
  });

  it('is a no-op on a second run: organization is not re-imported and settings carries the marker', async () => {
    const { deps } = seed(
      [{ path: organizationPath(STORE.mediaRoot), contents: JSON.stringify(ORGANIZATION_WITH_DUPLICATE_CATEGORY_IDS) }],
      baseDirectories('project-a', 'project-b'),
    );

    const first = await importLegacyMedia(deps, STORE);
    const rowsAfterFirst = {
      projects: deps.localStore.projects.list().length,
      folders: deps.localStore.organization.getOrganization().folders.length,
    };

    const second = await importLegacyMedia(deps, STORE);
    const rowsAfterSecond = {
      projects: deps.localStore.projects.list().length,
      folders: deps.localStore.organization.getOrganization().folders.length,
    };

    expect(first.organizationImported).toBe(true);
    expect(second.organizationImported).toBe(false);
    expect(second.projectsImported).toBe(0);
    expect(rowsAfterSecond).toEqual(rowsAfterFirst);
    expect(deps.localStore.settings.get('import.organization.v1')).not.toBeNull();
  });

  it('never writes, moves or deletes a source file', async () => {
    const { deps, callLog } = seed(
      [
        { path: organizationPath(STORE.mediaRoot), contents: JSON.stringify(ORGANIZATION_WITH_DUPLICATE_CATEGORY_IDS) },
        { path: `${STORE.mediaRoot}/project-a/work/producer/conversation.json`, contents: JSON.stringify(CONVERSATION) },
        { path: `${STORE.mediaRoot}/project-a/work/producer/session.json`, contents: JSON.stringify(SESSION) },
      ],
      baseDirectories('project-a', 'project-b'),
    );

    await importLegacyMedia(deps, STORE);

    const writePortsUsed = callLog.ports().filter((port) => WRITE_PORTS.includes(port));
    expect(writePortsUsed).toEqual([]);
  });

  it('imports a project conversation and session in order, with model, suggestions and turnId', async () => {
    const { deps } = seed(
      [
        { path: `${STORE.mediaRoot}/project-a/work/producer/conversation.json`, contents: JSON.stringify(CONVERSATION) },
        { path: `${STORE.mediaRoot}/project-a/work/producer/session.json`, contents: JSON.stringify(SESSION) },
      ],
      baseDirectories('project-a'),
    );

    const report = await importLegacyMedia(deps, STORE);

    expect(report.conversationsImported).toBe(1);
    expect(deps.localStore.producer.getConversation('project-a')).toEqual(CONVERSATION.messages);
    expect(deps.localStore.producer.getSession('project-a')).toEqual({
      sessionId: SESSION.sessionId,
      model: SESSION.model,
      startedAt: SESSION.createdAt,
      updatedAt: SESSION.lastTurnAt,
    });
  });

  it('does not re-import a conversation for a project that already has messages', async () => {
    const { deps } = seed(
      [{ path: `${STORE.mediaRoot}/project-a/work/producer/conversation.json`, contents: JSON.stringify(CONVERSATION) }],
      baseDirectories('project-a'),
    );
    deps.localStore.projects.insert('project-a');
    deps.localStore.producer.appendMessage('project-a', {
      id: 'existing',
      role: 'user',
      text: 'ya estaba',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    const report = await importLegacyMedia(deps, STORE);

    expect(report.conversationsImported).toBe(0);
    expect(deps.localStore.producer.getConversation('project-a')).toHaveLength(1);
  });

  it('skips a project with no conversation.json without reporting it', async () => {
    const { deps } = seed([], baseDirectories('project-a'));

    const report = await importLegacyMedia(deps, STORE);

    expect(report.conversationsImported).toBe(0);
    expect(report.skipped).toEqual([]);
  });

  it('skips a project with a corrupt conversation.json, reporting the reason, and imports nothing for it', async () => {
    const { deps } = seed(
      [{ path: `${STORE.mediaRoot}/project-a/work/producer/conversation.json`, contents: '{ not json at all' }],
      baseDirectories('project-a'),
    );

    const report = await importLegacyMedia(deps, STORE);

    expect(report.conversationsImported).toBe(0);
    expect(report.skipped).toEqual([{ slug: 'project-a', reason: 'conversation.json is not valid JSON' }]);
    expect(deps.localStore.producer.getConversation('project-a')).toEqual([]);
  });

  it('skips a project whose conversation.json parses but fails the message shape validation', async () => {
    const { deps } = seed(
      [{ path: `${STORE.mediaRoot}/project-a/work/producer/conversation.json`, contents: JSON.stringify({ messages: [{ role: 'user' }] }) }],
      baseDirectories('project-a'),
    );

    const report = await importLegacyMedia(deps, STORE);

    expect(report.conversationsImported).toBe(0);
    expect(report.skipped).toEqual([{ slug: 'project-a', reason: 'conversation.json failed validation' }]);
  });

  it('still imports the conversation when session.json is corrupt, reporting only the session as skipped', async () => {
    const { deps } = seed(
      [
        { path: `${STORE.mediaRoot}/project-a/work/producer/conversation.json`, contents: JSON.stringify(CONVERSATION) },
        { path: `${STORE.mediaRoot}/project-a/work/producer/session.json`, contents: 'not json' },
      ],
      baseDirectories('project-a'),
    );

    const report = await importLegacyMedia(deps, STORE);

    expect(report.conversationsImported).toBe(1);
    expect(deps.localStore.producer.getConversation('project-a')).toHaveLength(2);
    expect(deps.localStore.producer.getSession('project-a')).toBeNull();
    expect(report.skipped).toEqual([{ slug: 'project-a', reason: 'session.json is not valid JSON' }]);
  });

  it('returns zeroed counters and no skips for an empty media root', async () => {
    const { deps } = seed([], []);

    const report = await importLegacyMedia(deps, STORE);

    expect(report).toEqual({
      projectsImported: 0,
      organizationImported: false,
      conversationsImported: 0,
      skipped: [],
    });
  });
});
