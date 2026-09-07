import { writeFile } from 'node:fs/promises';

export type WriteTextFile = (path: string, contents: string) => Promise<void>;

export const nodeWriteTextFile: WriteTextFile = async (path, contents) => {
  await writeFile(path, contents, 'utf8');
};
