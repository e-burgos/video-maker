import { constants } from 'node:fs';
import { access, stat } from 'node:fs/promises';

export interface BinaryLookup {
  isExecutableFile(path: string): Promise<boolean>;
  isReadableFile(path: string): Promise<boolean>;
  isReadableDirectory(path: string): Promise<boolean>;
}

async function isAccessibleEntry(
  path: string,
  mode: number,
  isExpectedKind: (stats: Awaited<ReturnType<typeof stat>>) => boolean,
): Promise<boolean> {
  try {
    await access(path, mode);
    const stats = await stat(path);
    return isExpectedKind(stats);
  } catch {
    return false;
  }
}

export const nodeBinaryLookup: BinaryLookup = {
  isExecutableFile: (path) => isAccessibleEntry(path, constants.X_OK, (stats) => stats.isFile()),
  isReadableFile: (path) => isAccessibleEntry(path, constants.R_OK, (stats) => stats.isFile()),
  isReadableDirectory: (path) =>
    isAccessibleEntry(path, constants.R_OK, (stats) => stats.isDirectory()),
};
