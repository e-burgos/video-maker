import { mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { nodeEnsureDirectory } from './ensure-directory';

const baseDir = fileURLToPath(new URL('./__tmp-ensure-directory__/', import.meta.url));

let tempDir: string;

beforeEach(async () => {
  await mkdir(baseDir, { recursive: true });
  tempDir = await mkdtemp(`${baseDir}case-`);
});

afterEach(async () => {
  await rm(baseDir, { recursive: true, force: true });
});

describe('nodeEnsureDirectory', () => {
  it('crea directorios anidados que no existen', async () => {
    const nestedDir = `${tempDir}/work/transcripts/aroll`;

    await nodeEnsureDirectory(nestedDir);

    const stats = await stat(nestedDir);
    expect(stats.isDirectory()).toBe(true);
  });

  it('es idempotente si el directorio ya existe', async () => {
    const nestedDir = `${tempDir}/work`;

    await nodeEnsureDirectory(nestedDir);

    await expect(nodeEnsureDirectory(nestedDir)).resolves.toBeUndefined();
  });
});
