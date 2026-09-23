import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeObjectStorage } from '../__fixtures__/fake-object-storage';
import { EMPTY_ORGANIZATION } from './organization';
import { organizationPath, parseOrganization, readOrganization } from './organization-store';

const MEDIA_ROOT = '/media';

const ORGANIZATION = {
  folders: [{ id: 'display-ads', name: 'Display Ads', categories: [{ id: 'campanas', name: 'Campañas' }] }],
  videos: { 'editar-campana': { folderId: 'display-ads', categoryId: 'campanas', archived: false } },
};

describe('organizationPath', () => {
  it('hides the registry in a dotted directory, which the project scan already ignores', () => {
    expect(organizationPath(MEDIA_ROOT)).toBe('/media/.studio/organization.json');
  });
});

describe('parseOrganization', () => {
  it('reads a well formed document as it is', () => {
    expect(parseOrganization(ORGANIZATION)).toEqual(ORGANIZATION);
  });

  it('answers an empty organization for anything that is not an object', () => {
    expect(parseOrganization(null)).toEqual(EMPTY_ORGANIZATION);
    expect(parseOrganization([])).toEqual(EMPTY_ORGANIZATION);
    expect(parseOrganization('{}')).toEqual(EMPTY_ORGANIZATION);
  });

  it('drops folders and categories that carry no usable identifier', () => {
    const parsed = parseOrganization({
      folders: [
        { id: 'Not Valid', name: 'x' },
        { id: 'ok', name: 'Ok', categories: [{ id: 'good', name: 'Good' }, { id: 'Bad Id', name: 'y' }, 7] },
        'nonsense',
      ],
      videos: {},
    });

    expect(parsed.folders).toEqual([{ id: 'ok', name: 'Ok', categories: [{ id: 'good', name: 'Good' }] }]);
  });

  it('forgets a placement whose folder or category no longer exists, instead of hiding the video', () => {
    const parsed = parseOrganization({
      folders: [{ id: 'ok', name: 'Ok', categories: [] }],
      videos: {
        orphan: { folderId: 'gone', categoryId: 'gone-too', archived: false },
        'wrong-category': { folderId: 'ok', categoryId: 'gone', archived: true },
      },
    });

    expect(parsed.videos['orphan']).toEqual({ folderId: null, categoryId: null, archived: false });
    expect(parsed.videos['wrong-category']).toEqual({ folderId: 'ok', categoryId: null, archived: true });
  });
});

describe('readOrganization', () => {
  it('answers an empty organization when the registry does not exist yet', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog);

    expect(await readOrganization(storage, MEDIA_ROOT)).toEqual(EMPTY_ORGANIZATION);
  });

  it('answers an empty organization instead of throwing when the file is corrupt', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      files: [{ path: organizationPath(MEDIA_ROOT), contents: 'not json at all' }],
    });

    expect(await readOrganization(storage, MEDIA_ROOT)).toEqual(EMPTY_ORGANIZATION);
  });

  it('reads a persisted document, as the importer will find it on disk', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      files: [{ path: organizationPath(MEDIA_ROOT), contents: JSON.stringify(ORGANIZATION) }],
    });

    expect(await readOrganization(storage, MEDIA_ROOT)).toEqual(ORGANIZATION);
  });
});
