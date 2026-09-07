import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { nodeWriteTextFile } from './write-text-file';

const baseDir = fileURLToPath(new URL('./__tmp-write-text-file__/', import.meta.url));

let tempDir: string;

beforeEach(async () => {
  await mkdir(baseDir, { recursive: true });
  tempDir = await mkdtemp(`${baseDir}case-`);
});

afterEach(async () => {
  await rm(baseDir, { recursive: true, force: true });
});

describe('nodeWriteTextFile', () => {
  it('escribe el contenido en utf8 y puede releerse', async () => {
    const filePath = `${tempDir}/catalog.json`;

    await nodeWriteTextFile(filePath, '{"schemaVersion":1}');

    await expect(readFile(filePath, 'utf8')).resolves.toBe('{"schemaVersion":1}');
  });

  it('sobrescribe el contenido de una escritura previa', async () => {
    const filePath = `${tempDir}/catalog.json`;

    await nodeWriteTextFile(filePath, 'primero');
    await nodeWriteTextFile(filePath, 'segundo');

    await expect(readFile(filePath, 'utf8')).resolves.toBe('segundo');
  });
});
