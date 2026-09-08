import { TimelineSchema, buildTimeline, defaultFormat } from '@video-maker/timeline-core';
import type { EditDecisionList, MediaAsset, Timeline } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { createFakeFileSystem } from '../__fixtures__/fake-file-system';
import { resolveMediaProject } from '../project/media-project';
import { writeTimeline } from './write-timeline';

const project = resolveMediaProject('/tmp/media/pitch-deck');

function fixtureTimeline(): Timeline {
  const edl: EditDecisionList = {
    schemaVersion: 1,
    sourceAssetId: 'raw/aroll/camara.mp4',
    format: defaultFormat('reels-9x16'),
    generatedBy: { tool: 'auto-montage', params: { preset: 'software-demo', seed: 1 } },
    decisions: [{ id: 'keep-0001', type: 'keep', startMs: 0, endMs: 2000 }],
  };
  const assets: MediaAsset[] = [
    {
      id: 'raw/aroll/camara.mp4',
      kind: 'video',
      path: 'raw/aroll/camara.mp4',
      durationMs: 5000,
      fps: 30,
      width: 1920,
      height: 1080,
      hasAudio: true,
      probedAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  return buildTimeline(edl, assets);
}

describe('writeTimeline', () => {
  it('escribe la Timeline serializada bajo work/timeline.json con newline final y devuelve su ruta', async () => {
    const fakeFileSystem = createFakeFileSystem();

    const path = await writeTimeline(project, fixtureTimeline(), {
      writeTextFile: fakeFileSystem.writeTextFile,
      ensureDirectory: fakeFileSystem.ensureDirectory,
    });

    expect(path).toBe('work/timeline.json');
    const written = fakeFileSystem.readFile('/tmp/media/pitch-deck/work/timeline.json');
    expect(written).toBe(`${JSON.stringify(TimelineSchema.parse(fixtureTimeline()), null, 2)}\n`);
  });

  it('asegura el directorio work/ antes de escribir', async () => {
    const fakeFileSystem = createFakeFileSystem();

    await writeTimeline(project, fixtureTimeline(), {
      writeTextFile: fakeFileSystem.writeTextFile,
      ensureDirectory: fakeFileSystem.ensureDirectory,
    });

    expect(fakeFileSystem.ensuredDirectories).toContain('/tmp/media/pitch-deck/work');
  });

  it('rechaza persistir una Timeline que no cumple el schema y no escribe nada', async () => {
    const fakeFileSystem = createFakeFileSystem();
    const invalidTimeline = { ...fixtureTimeline(), schemaVersion: 999 } as unknown as Timeline;

    await expect(
      writeTimeline(project, invalidTimeline, {
        writeTextFile: fakeFileSystem.writeTextFile,
        ensureDirectory: fakeFileSystem.ensureDirectory,
      }),
    ).rejects.toThrow();
    expect(fakeFileSystem.writtenFiles.size).toBe(0);
  });

  it('D-6/D-7: el archivo serializado no lleva generatedAt ni rutas absolutas', async () => {
    const fakeFileSystem = createFakeFileSystem();

    await writeTimeline(project, fixtureTimeline(), {
      writeTextFile: fakeFileSystem.writeTextFile,
      ensureDirectory: fakeFileSystem.ensureDirectory,
    });

    const written = fakeFileSystem.readFile('/tmp/media/pitch-deck/work/timeline.json') ?? '';
    expect(written).not.toContain('generatedAt');
    expect(written).not.toContain('/tmp/media/pitch-deck');
  });
});
