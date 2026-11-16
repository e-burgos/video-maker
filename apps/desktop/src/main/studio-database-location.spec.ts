import { describe, expect, it } from 'vitest';

import { adoptLegacyStudioDatabase, studioDatabasePath } from './studio-database-location';
import type { StudioDatabaseFileSystem } from './studio-database-location';

function memoryFileSystem(existing: readonly string[]) {
  const files = new Set(existing);
  const copies: [string, string][] = [];
  const fileSystem: StudioDatabaseFileSystem = {
    exists: (path) => files.has(path),
    makeDirectory: () => undefined,
    copyFile: (from, to) => {
      copies.push([from, to]);
      files.add(to);
    },
  };
  return { fileSystem, copies };
}

describe('studio database location', () => {
  it('lives inside the projects folder, where the web studio keeps it', () => {
    expect(studioDatabasePath('/media')).toBe('/media/.studio/studio.db');
  });

  it('keeps the database the projects folder already has', () => {
    const { fileSystem, copies } = memoryFileSystem(['/media/.studio/studio.db', '/app/studio.db']);
    expect(adoptLegacyStudioDatabase({ legacyPath: '/app/studio.db', projectsFolder: '/media' }, fileSystem)).toBe(
      'already-in-projects-folder',
    );
    expect(copies).toEqual([]);
  });

  it('brings the old app database with its write-ahead log when the folder has none', () => {
    const { fileSystem, copies } = memoryFileSystem(['/app/studio.db', '/app/studio.db-wal']);
    expect(adoptLegacyStudioDatabase({ legacyPath: '/app/studio.db', projectsFolder: '/media' }, fileSystem)).toBe(
      'adopted-legacy',
    );
    expect(copies).toEqual([
      ['/app/studio.db-wal', '/media/.studio/studio.db-wal'],
      ['/app/studio.db', '/media/.studio/studio.db'],
    ]);
  });

  it('starts fresh when there is no database anywhere', () => {
    const { fileSystem } = memoryFileSystem([]);
    expect(adoptLegacyStudioDatabase({ legacyPath: '/app/studio.db', projectsFolder: '/media' }, fileSystem)).toBe('fresh');
  });
});
