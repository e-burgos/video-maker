import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const STUDIO_DIRECTORY_NAME = '.studio';
export const STUDIO_DATABASE_FILE_NAME = 'studio.db';
const SQLITE_COMPANION_SUFFIXES = ['-wal', '-shm'] as const;

export type StudioDatabaseAdoption = 'already-in-projects-folder' | 'adopted-legacy' | 'fresh';

export interface StudioDatabaseFileSystem {
  readonly exists: (path: string) => boolean;
  readonly makeDirectory: (path: string) => void;
  readonly copyFile: (from: string, to: string) => void;
}

const NODE_FILE_SYSTEM: StudioDatabaseFileSystem = {
  exists: existsSync,
  makeDirectory: (path) => mkdirSync(path, { recursive: true }),
  copyFile: copyFileSync,
};

export function studioDatabasePath(projectsFolder: string): string {
  return join(projectsFolder, STUDIO_DIRECTORY_NAME, STUDIO_DATABASE_FILE_NAME);
}

export function adoptLegacyStudioDatabase(
  input: { readonly legacyPath: string; readonly projectsFolder: string },
  fileSystem: StudioDatabaseFileSystem = NODE_FILE_SYSTEM,
): StudioDatabaseAdoption {
  const target = studioDatabasePath(input.projectsFolder);
  if (fileSystem.exists(target)) {
    return 'already-in-projects-folder';
  }
  if (!fileSystem.exists(input.legacyPath)) {
    return 'fresh';
  }
  fileSystem.makeDirectory(dirname(target));
  for (const suffix of SQLITE_COMPANION_SUFFIXES) {
    if (fileSystem.exists(`${input.legacyPath}${suffix}`)) {
      fileSystem.copyFile(`${input.legacyPath}${suffix}`, `${target}${suffix}`);
    }
  }
  fileSystem.copyFile(input.legacyPath, target);
  return 'adopted-legacy';
}
