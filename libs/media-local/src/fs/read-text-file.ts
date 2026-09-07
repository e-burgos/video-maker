import { readFile } from 'node:fs/promises';

export type ReadTextFile = (path: string) => Promise<string>;

export const nodeReadTextFile: ReadTextFile = (path) => readFile(path, 'utf8');
