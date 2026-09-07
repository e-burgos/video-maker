import { mkdir } from 'node:fs/promises';

export type EnsureDirectory = (path: string) => Promise<void>;

export const nodeEnsureDirectory: EnsureDirectory = async (path) => {
  await mkdir(path, { recursive: true });
};
