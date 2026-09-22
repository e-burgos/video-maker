import { describe, expect, it } from 'vitest';

import {
  EMPTY_ORGANIZATION,
  addCategory,
  addFolder,
  archiveVideo,
  findCategory,
  findFolder,
  forgetVideo,
  isValidIdentifier,
  normalizeName,
  placeVideo,
  placementOf,
  removeCategory,
  removeFolder,
  renameFolder,
  toIdentifier,
} from './organization';
import type { Organization, VideoFolder } from './organization';

function organizationWithFolder(name: string): { organization: Organization; folderId: string } {
  const { organization, folder } = addFolder(EMPTY_ORGANIZATION, name);
  return { organization, folderId: folder.id };
}

function folderOf(organization: Organization, folderId: string): VideoFolder {
  const folder = findFolder(organization, folderId);
  if (folder === null) {
    throw new Error(`the fixture lost the folder ${folderId}`);
  }
  return folder;
}

describe('toIdentifier', () => {
  it('turns a human name into a kebab-case identifier without diacritics', () => {
    expect(toIdentifier('Campañas de Verano')).toBe('campanas-de-verano');
    expect(toIdentifier('  Display   Ads  ')).toBe('display-ads');
    expect(toIdentifier('Tutoriales 2026')).toBe('tutoriales-2026');
  });

  it('answers an empty identifier when the name holds no letter or digit', () => {
    expect(toIdentifier('   ')).toBe('');
    expect(toIdentifier('***')).toBe('');
  });

  it('produces identifiers the store accepts back', () => {
    expect(isValidIdentifier(toIdentifier('Campañas de Verano'))).toBe(true);
    expect(isValidIdentifier('Not Valid')).toBe(false);
  });
});

describe('normalizeName', () => {
  it('collapses whitespace and caps the length', () => {
    expect(normalizeName('  Display   Ads  ')).toBe('Display Ads');
    expect(normalizeName('x'.repeat(200))).toHaveLength(60);
  });
});

describe('addFolder', () => {
  it('derives the id from the name and keeps the name as the user wrote it', () => {
    const { organization, folder } = addFolder(EMPTY_ORGANIZATION, 'Display Ads');

    expect(folder).toEqual({ id: 'display-ads', name: 'Display Ads', categories: [] });
    expect(organization.folders).toEqual([folder]);
  });

  it('never collides: a repeated name gets a numbered identifier', () => {
    const first = addFolder(EMPTY_ORGANIZATION, 'Display Ads');
    const second = addFolder(first.organization, 'Display Ads');
    const third = addFolder(second.organization, 'display ads');

    expect(second.folder.id).toBe('display-ads-2');
    expect(third.folder.id).toBe('display-ads-3');
  });
});

describe('renameFolder', () => {
  it('changes the name and keeps the identifier, so the placements survive', () => {
    const { organization, folderId } = organizationWithFolder('Display Ads');
    const placed = placeVideo(organization, 'editar-campana', { folderId, categoryId: null });

    const renamed = renameFolder(placed, folderId, 'Publicidad Display');

    expect(findFolder(renamed, folderId)?.name).toBe('Publicidad Display');
    expect(placementOf(renamed, 'editar-campana').folderId).toBe(folderId);
  });
});

describe('removeFolder', () => {
  it('drops the folder and sends its videos back to no folder instead of orphaning them', () => {
    const { organization, folderId } = organizationWithFolder('Display Ads');
    const withCategory = addCategory(organization, folderOf(organization, folderId), 'Campañas');
    const placed = placeVideo(withCategory.organization, 'editar-campana', {
      folderId,
      categoryId: withCategory.category.id,
    });

    const result = removeFolder(placed, folderId);

    expect(result.folders).toEqual([]);
    expect(placementOf(result, 'editar-campana')).toEqual({
      folderId: null,
      categoryId: null,
      archived: false,
    });
  });

  it('leaves the videos of the other folders untouched', () => {
    const first = addFolder(EMPTY_ORGANIZATION, 'Display Ads');
    const second = addFolder(first.organization, 'Tutoriales');
    const placed = placeVideo(second.organization, 'tutorial-uno', {
      folderId: second.folder.id,
      categoryId: null,
    });

    const result = removeFolder(placed, first.folder.id);

    expect(placementOf(result, 'tutorial-uno').folderId).toBe(second.folder.id);
  });
});

describe('addCategory and removeCategory', () => {
  it('adds a category inside its folder and nowhere else', () => {
    const first = addFolder(EMPTY_ORGANIZATION, 'Display Ads');
    const second = addFolder(first.organization, 'Tutoriales');
    const withCategory = addCategory(second.organization, first.folder, 'Campañas');

    expect(findCategory(folderOf(withCategory.organization, first.folder.id), 'campanas')).toEqual({
      id: 'campanas',
      name: 'Campañas',
    });
    expect(findFolder(withCategory.organization, second.folder.id)?.categories).toEqual([]);
  });

  it('keeps the videos in the folder when their category is removed', () => {
    const { organization, folderId } = organizationWithFolder('Display Ads');
    const withCategory = addCategory(organization, folderOf(organization, folderId), 'Campañas');
    const placed = placeVideo(withCategory.organization, 'editar-campana', {
      folderId,
      categoryId: withCategory.category.id,
    });

    const result = removeCategory(placed, folderId, withCategory.category.id);

    expect(findFolder(result, folderId)?.categories).toEqual([]);
    expect(placementOf(result, 'editar-campana')).toEqual({
      folderId,
      categoryId: null,
      archived: false,
    });
  });
});

describe('placeVideo and archiveVideo', () => {
  it('reads an unknown video as unplaced, so a fresh media root needs no entries', () => {
    expect(placementOf(EMPTY_ORGANIZATION, 'never-seen')).toEqual({
      folderId: null,
      categoryId: null,
      archived: false,
    });
  });

  it('stores nothing for a video that goes back to its default placement', () => {
    const { organization, folderId } = organizationWithFolder('Display Ads');
    const placed = placeVideo(organization, 'editar-campana', { folderId, categoryId: null });

    const unplaced = placeVideo(placed, 'editar-campana', { folderId: null, categoryId: null });

    expect(Object.keys(unplaced.videos)).toEqual([]);
  });

  it('keeps the folder when only the archived flag changes, and the other way around', () => {
    const { organization, folderId } = organizationWithFolder('Display Ads');
    const placed = placeVideo(organization, 'editar-campana', { folderId, categoryId: null });

    const archived = archiveVideo(placed, 'editar-campana', true);
    expect(placementOf(archived, 'editar-campana')).toEqual({
      folderId,
      categoryId: null,
      archived: true,
    });

    const moved = placeVideo(archived, 'editar-campana', { folderId: null, categoryId: null });
    expect(placementOf(moved, 'editar-campana').archived).toBe(true);
  });

  it('remembers an archived video that belongs to no folder', () => {
    const archived = archiveVideo(EMPTY_ORGANIZATION, 'suelto', true);

    expect(archived.videos['suelto']).toEqual({ folderId: null, categoryId: null, archived: true });
  });
});

describe('forgetVideo', () => {
  it('removes every trace of a deleted video', () => {
    const { organization, folderId } = organizationWithFolder('Display Ads');
    const placed = placeVideo(organization, 'editar-campana', { folderId, categoryId: null });

    const result = forgetVideo(placed, 'editar-campana');

    expect(result.videos).toEqual({});
    expect(result.folders).toHaveLength(1);
  });
});
