import { readdir } from 'node:fs/promises';

export interface DirectoryEntry {
  readonly name: string;
  readonly isDirectory: boolean;
  readonly isFile: boolean;
}

export interface DirectoryReader {
  readDirectory(path: string): Promise<readonly DirectoryEntry[]>;
}

export const nodeDirectoryReader: DirectoryReader = {
  readDirectory: async (path) => {
    const entries = await readdir(path, { withFileTypes: true });
    return entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      isFile: entry.isFile(),
    }));
  },
};
