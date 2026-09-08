import type { ResolvedBinaries } from '@video-maker/media-local';
import { FixtureCommandRunner } from '@video-maker/media-local';
import { EditDecisionListSchema, TimelineSchema, validateTimeline } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { autoMontage } from './auto-montage';
import { createFakeFileSystem } from './__fixtures__/fake-file-system';
import { ingestProject } from './ingest/ingest-project';
import type { IngestDependencies } from './ingest/ingest-project';
import { resolveMediaProject } from './project/media-project';

const project = resolveMediaProject('/tmp/media/e2e-project');

const binaries: ResolvedBinaries = {
  ffmpeg: 'ffmpeg',
  ffprobe: 'ffprobe',
  whisperCli: 'whisper-cli',
  whisperModel: '/models/ggml-base.bin',
};

const VIDEO_STDOUT = JSON.stringify({
  streams: [
    {
      index: 0,
      codec_name: 'h264',
      codec_type: 'video',
      width: 1280,
      height: 720,
      r_frame_rate: '30/1',
      avg_frame_rate: '30/1',
      duration: '8.000000',
    },
  ],
  format: { filename: 'clip01.mp4', format_name: 'mov,mp4,m4a,3gp,3g2,mj2', duration: '8.000000' },
});

const WHISPER_RAW_OUTPUT = JSON.stringify({
  transcription: [
    { offsets: { from: 0, to: 300 }, text: ' hola' },
    { offsets: { from: 300, to: 600 }, text: ' vamos' },
    { offsets: { from: 600, to: 1000 }, text: ' abrir' },
    { offsets: { from: 1600, to: 2100 }, text: ' terminal' },
    { offsets: { from: 2100, to: 2600 }, text: ' listo' },
  ],
});

function activeRunner(): FixtureCommandRunner {
  return new FixtureCommandRunner([
    { bin: 'ffprobe', response: { stdout: VIDEO_STDOUT, exitCode: 0 } },
    { bin: 'ffmpeg', response: { exitCode: 0 } },
    { bin: 'whisper-cli', response: { exitCode: 0 } },
  ]);
}

describe('camino público completo: resolveMediaProject → ingestProject → autoMontage', () => {
  it('produce edl.json/timeline.json coherentes sobre un proyecto recién ingerido, con puertos fake', async () => {
    const fakeFileSystem = createFakeFileSystem([
      {
        path: '/tmp/media/e2e-project/raw/aroll/clip01.mp4',
        contents: 'contenido-del-clip',
        sizeBytes: 12_345,
        modifiedAtMs: 1_700_000_000_000,
      },
      {
        path: '/tmp/media/e2e-project/work/whisper/aroll/clip01.json',
        contents: WHISPER_RAW_OUTPUT,
      },
    ]);

    const ingestDeps: IngestDependencies = {
      runner: activeRunner(),
      readDirectory: fakeFileSystem.directoryReader,
      statFile: fakeFileSystem.fileStatReader,
      readTextFile: fakeFileSystem.readTextFile,
      writeTextFile: fakeFileSystem.writeTextFile,
      ensureDirectory: fakeFileSystem.ensureDirectory,
    };

    const ingestResult = await ingestProject(project, { binaries }, ingestDeps);
    expect(ingestResult.catalog.assets).toHaveLength(1);
    expect(ingestResult.transcribedAssetIds).toEqual(['raw/aroll/clip01.mp4']);
    expect(fakeFileSystem.readFile('/tmp/media/e2e-project/work/catalog.json')).toBeDefined();

    const montageResult = await autoMontage(
      project,
      { preset: 'software-demo', seed: 1 },
      {
        readTextFile: fakeFileSystem.readTextFile,
        writeTextFile: fakeFileSystem.writeTextFile,
        ensureDirectory: fakeFileSystem.ensureDirectory,
      },
    );

    expect(montageResult.transcriptionSource).toBe('catalog');
    expect(validateTimeline(montageResult.timeline).ok).toBe(true);

    const writtenEdl = fakeFileSystem.readFile('/tmp/media/e2e-project/work/edl.json');
    const writtenTimeline = fakeFileSystem.readFile('/tmp/media/e2e-project/work/timeline.json');
    expect(writtenEdl).toBeDefined();
    expect(writtenTimeline).toBeDefined();

    expect(writtenEdl).toBe(`${JSON.stringify(EditDecisionListSchema.parse(montageResult.edl), null, 2)}\n`);
    expect(writtenTimeline).toBe(
      `${JSON.stringify(TimelineSchema.parse(montageResult.timeline), null, 2)}\n`,
    );

    const rereadEdl = EditDecisionListSchema.parse(JSON.parse(writtenEdl ?? '{}'));
    expect(rereadEdl.sourceAssetId).toBe('raw/aroll/clip01.mp4');
  });
});
