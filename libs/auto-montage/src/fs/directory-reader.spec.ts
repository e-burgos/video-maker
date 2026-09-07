import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { nodeDirectoryReader } from './directory-reader';

const baseDir = fileURLToPath(new URL('./__tmp-directory-reader__/', import.meta.url));

let tempDir: string;

beforeEach(async () => {
  await mkdir(baseDir, { recursive: true });
  tempDir = await mkdtemp(`${baseDir}case-`);
});

afterEach(async () => {
  await rm(baseDir, { recursive: true, force: true });
});

describe('nodeDirectoryReader', () => {
  it('lista archivos y subdirectorios distinguiendo su tipo', async () => {
    await writeFile(`${tempDir}/clip01.mp4`, 'contenido');
    await mkdir(`${tempDir}/aroll`, { recursive: true });

    const entries = await nodeDirectoryReader.readDirectory(tempDir);
    const byName = new Map(entries.map((entry) => [entry.name, entry]));

    expect(byName.get('clip01.mp4')).toEqual({ name: 'clip01.mp4', isDirectory: false, isFile: true });
    expect(byName.get('aroll')).toEqual({ name: 'aroll', isDirectory: true, isFile: false });
  });

  it('devuelve una lista vacía para un directorio vacío', async () => {
    await expect(nodeDirectoryReader.readDirectory(tempDir)).resolves.toEqual([]);
  });

  it('rechaza cuando el directorio no existe', async () => {
    await expect(nodeDirectoryReader.readDirectory(`${tempDir}/no-existe`)).rejects.toThrow();
  });
});
