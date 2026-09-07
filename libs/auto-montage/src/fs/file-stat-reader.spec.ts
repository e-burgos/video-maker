import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { nodeFileStatReader } from './file-stat-reader';

const baseDir = fileURLToPath(new URL('./__tmp-file-stat-reader__/', import.meta.url));

let tempDir: string;

beforeEach(async () => {
  await mkdir(baseDir, { recursive: true });
  tempDir = await mkdtemp(`${baseDir}case-`);
});

afterEach(async () => {
  await rm(baseDir, { recursive: true, force: true });
});

describe('nodeFileStatReader', () => {
  it('reporta el tamaño en bytes y el mtime truncado a entero', async () => {
    const filePath = `${tempDir}/clip01.mp4`;
    await writeFile(filePath, 'contenido-de-prueba');
    const realStats = await stat(filePath);

    const fileStats = await nodeFileStatReader.statFile(filePath);

    expect(fileStats.sizeBytes).toBe(realStats.size);
    expect(fileStats.modifiedAtMs).toBe(Math.trunc(realStats.mtimeMs));
    expect(Number.isInteger(fileStats.modifiedAtMs)).toBe(true);
  });

  it('rechaza cuando el archivo no existe', async () => {
    await expect(nodeFileStatReader.statFile(`${tempDir}/no-existe.mp4`)).rejects.toThrow();
  });
});
