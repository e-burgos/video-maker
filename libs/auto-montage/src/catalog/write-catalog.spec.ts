import { describe, expect, it } from 'vitest';

import { createFakeFileSystem } from '../__fixtures__/fake-file-system';
import { resolveMediaProject } from '../project/media-project';
import { CATALOG_SCHEMA_VERSION } from './catalog.schema';
import type { Catalog } from './catalog.schema';
import { writeCatalog } from './write-catalog';

const project = resolveMediaProject('/tmp/media/pitch-deck');

function emptyCatalog(): Catalog {
  return {
    schemaVersion: CATALOG_SCHEMA_VERSION,
    projectSlug: project.slug,
    assets: [],
    transcripts: [],
    ignored: [],
    probeFailures: [],
  };
}

describe('writeCatalog', () => {
  it('escribe el catálogo serializado bajo work/catalog.json con newline final', async () => {
    const fakeFileSystem = createFakeFileSystem();

    await writeCatalog(project, emptyCatalog(), {
      writeTextFile: fakeFileSystem.writeTextFile,
      ensureDirectory: fakeFileSystem.ensureDirectory,
    });

    const written = fakeFileSystem.readFile('/tmp/media/pitch-deck/work/catalog.json');
    expect(written).toBe(`${JSON.stringify(emptyCatalog(), null, 2)}\n`);
  });

  it('asegura el directorio work/ antes de escribir', async () => {
    const fakeFileSystem = createFakeFileSystem();

    await writeCatalog(project, emptyCatalog(), {
      writeTextFile: fakeFileSystem.writeTextFile,
      ensureDirectory: fakeFileSystem.ensureDirectory,
    });

    expect(fakeFileSystem.ensuredDirectories).toContain('/tmp/media/pitch-deck/work');
  });

  it('rechaza persistir un catálogo que no cumple el schema y no escribe nada', async () => {
    const fakeFileSystem = createFakeFileSystem();
    const invalidCatalog = { ...emptyCatalog(), schemaVersion: 999 } as unknown as Catalog;

    await expect(
      writeCatalog(project, invalidCatalog, {
        writeTextFile: fakeFileSystem.writeTextFile,
        ensureDirectory: fakeFileSystem.ensureDirectory,
      }),
    ).rejects.toThrow();
    expect(fakeFileSystem.writtenFiles.size).toBe(0);
  });
});
