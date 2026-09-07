import { constants } from 'node:fs';
import { access, stat } from 'node:fs/promises';

export interface BinaryLookup {
  isExecutableFile(path: string): Promise<boolean>;
  isReadableFile(path: string): Promise<boolean>;
}

async function isAccessibleFile(path: string, mode: number): Promise<boolean> {
  try {
    await access(path, mode);
    const stats = await stat(path);
    return stats.isFile();
  } catch {
    return false;
  }
}

export const nodeBinaryLookup: BinaryLookup = {
  isExecutableFile: (path) => isAccessibleFile(path, constants.X_OK),
  isReadableFile: (path) => isAccessibleFile(path, constants.R_OK),
};
