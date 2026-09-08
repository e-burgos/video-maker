import { EditDecisionListSchema, defaultFormat } from '@video-maker/timeline-core';
import type { EditDecisionList } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { createFakeFileSystem } from '../__fixtures__/fake-file-system';
import { resolveMediaProject } from '../project/media-project';
import { writeEditDecisionList } from './write-edit-decision-list';

const project = resolveMediaProject('/tmp/media/pitch-deck');

function fixtureEdl(): EditDecisionList {
  return {
    schemaVersion: 1,
    sourceAssetId: 'raw/aroll/camara.mp4',
    format: defaultFormat('reels-9x16'),
    generatedBy: { tool: 'auto-montage', params: { preset: 'software-demo', seed: 1 } },
    decisions: [{ id: 'keep-0001', type: 'keep', startMs: 0, endMs: 2000 }],
  };
}

describe('writeEditDecisionList', () => {
  it('escribe el EDL serializado bajo work/edl.json con newline final y devuelve su ruta', async () => {
    const fakeFileSystem = createFakeFileSystem();

    const path = await writeEditDecisionList(project, fixtureEdl(), {
      writeTextFile: fakeFileSystem.writeTextFile,
      ensureDirectory: fakeFileSystem.ensureDirectory,
    });

    expect(path).toBe('work/edl.json');
    const written = fakeFileSystem.readFile('/tmp/media/pitch-deck/work/edl.json');
    expect(written).toBe(`${JSON.stringify(EditDecisionListSchema.parse(fixtureEdl()), null, 2)}\n`);
  });

  it('asegura el directorio work/ antes de escribir', async () => {
    const fakeFileSystem = createFakeFileSystem();

    await writeEditDecisionList(project, fixtureEdl(), {
      writeTextFile: fakeFileSystem.writeTextFile,
      ensureDirectory: fakeFileSystem.ensureDirectory,
    });

    expect(fakeFileSystem.ensuredDirectories).toContain('/tmp/media/pitch-deck/work');
  });

  it('rechaza persistir un EDL que no cumple el schema y no escribe nada', async () => {
    const fakeFileSystem = createFakeFileSystem();
    const invalidEdl = { ...fixtureEdl(), schemaVersion: 999 } as unknown as EditDecisionList;

    await expect(
      writeEditDecisionList(project, invalidEdl, {
        writeTextFile: fakeFileSystem.writeTextFile,
        ensureDirectory: fakeFileSystem.ensureDirectory,
      }),
    ).rejects.toThrow();
    expect(fakeFileSystem.writtenFiles.size).toBe(0);
  });

  it('D-6/D-7: el archivo serializado no lleva generatedAt ni rutas absolutas', async () => {
    const fakeFileSystem = createFakeFileSystem();

    await writeEditDecisionList(project, fixtureEdl(), {
      writeTextFile: fakeFileSystem.writeTextFile,
      ensureDirectory: fakeFileSystem.ensureDirectory,
    });

    const written = fakeFileSystem.readFile('/tmp/media/pitch-deck/work/edl.json') ?? '';
    expect(written).not.toContain('generatedAt');
    expect(written).not.toContain('/tmp/media/pitch-deck');
  });
});
