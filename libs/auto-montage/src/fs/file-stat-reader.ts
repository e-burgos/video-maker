import { stat } from 'node:fs/promises';

export interface FileStats {
  readonly sizeBytes: number;
  readonly modifiedAtMs: number;
}

export interface FileStatReader {
  statFile(path: string): Promise<FileStats>;
}

export const nodeFileStatReader: FileStatReader = {
  statFile: async (path) => {
    const stats = await stat(path);
    return {
      sizeBytes: stats.size,
      modifiedAtMs: Math.trunc(stats.mtimeMs),
    };
  },
};
