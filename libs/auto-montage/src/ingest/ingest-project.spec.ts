import type { ResolvedBinaries } from '@video-maker/media-local';
import { FixtureCommandRunner } from '@video-maker/media-local';
import { describe, expect, it } from 'vitest';

import { createFakeFileSystem } from '../__fixtures__/fake-file-system';
import { AssetProbeFailedError } from '../errors/asset-probe-failed-error';
import { resolveMediaProject } from '../project/media-project';
import { ingestProject } from './ingest-project';
import type { IngestDependencies } from './ingest-project';

const project = resolveMediaProject('/tmp/media/pitch-deck');

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
      duration: '5.000000',
    },
  ],
  format: { filename: 'clip01.mp4', format_name: 'mov,mp4,m4a,3gp,3g2,mj2', duration: '5.000000' },
});

const WHISPER_RAW_OUTPUT = JSON.stringify({
  transcription: [
    { offsets: { from: 0, to: 500 }, text: ' Hola' },
    { offsets: { from: 520, to: 900 }, text: ' mundo' },
  ],
});

function activeRunner(): FixtureCommandRunner {
  return new FixtureCommandRunner([
    { bin: 'ffprobe', response: { stdout: VIDEO_STDOUT, exitCode: 0 } },
    { bin: 'ffmpeg', response: { exitCode: 0 } },
    { bin: 'whisper-cli', response: { exitCode: 0 } },
  ]);
}

describe('ingestProject — ingesta doble sobre material sin cambios (CA-004 / D-6)', () => {
  it('la segunda ingesta no invoca al runner y produce un catalog.json idéntico byte a byte', async () => {
    const fakeFileSystem = createFakeFileSystem([
      {
        path: '/tmp/media/pitch-deck/raw/aroll/clip01.mp4',
        contents: 'contenido-del-clip',
        sizeBytes: 12_345,
        modifiedAtMs: 1_700_000_000_000,
      },
      {
        path: '/tmp/media/pitch-deck/work/whisper/aroll/clip01.json',
        contents: WHISPER_RAW_OUTPUT,
      },
    ]);

    const buildDeps = (runner: FixtureCommandRunner): IngestDependencies => ({
      runner,
      readDirectory: fakeFileSystem.directoryReader,
      statFile: fakeFileSystem.fileStatReader,
      readTextFile: fakeFileSystem.readTextFile,
      writeTextFile: fakeFileSystem.writeTextFile,
      ensureDirectory: fakeFileSystem.ensureDirectory,
    });

    const firstRunner = activeRunner();
    const firstResult = await ingestProject(project, { binaries }, buildDeps(firstRunner));

    expect(firstResult.staleCatalogReplaced).toBe(false);
    expect(firstResult.transcribedAssetIds).toEqual(['raw/aroll/clip01.mp4']);
    expect(firstResult.reusedTranscriptionAssetIds).toEqual([]);
    expect(firstResult.reusedProbeAssetIds).toEqual([]);
    expect(firstResult.probeFailures).toEqual([]);
    expect(firstResult.transcriptionFailures).toEqual([]);
    expect(firstResult.catalog.assets).toHaveLength(1);
    expect(firstResult.catalog.assets[0]?.asset.id).toBe('raw/aroll/clip01.mp4');

    const firstWrittenCatalog = fakeFileSystem.readFile('/tmp/media/pitch-deck/work/catalog.json');
    expect(firstWrittenCatalog).toBeDefined();

    const secondRunner = new FixtureCommandRunner([]);
    const secondResult = await ingestProject(project, { binaries }, buildDeps(secondRunner));

    expect(secondRunner.calls.length).toBe(0);
    expect(secondResult.staleCatalogReplaced).toBe(false);
    expect(secondResult.transcribedAssetIds).toEqual([]);
    expect(secondResult.reusedTranscriptionAssetIds).toEqual(['raw/aroll/clip01.mp4']);
    expect(secondResult.reusedProbeAssetIds).toEqual(['raw/aroll/clip01.mp4']);
    expect(secondResult.probeFailures).toEqual([]);
    expect(secondResult.transcriptionFailures).toEqual([]);

    const secondWrittenCatalog = fakeFileSystem.readFile('/tmp/media/pitch-deck/work/catalog.json');
    expect(secondWrittenCatalog).toBe(firstWrittenCatalog);
  });
});

describe('ingestProject — catálogo previo corrupto (D-8)', () => {
  it('no aborta: degrada a ingesta completa y marca staleCatalogReplaced', async () => {
    const fakeFileSystem = createFakeFileSystem([
      {
        path: '/tmp/media/pitch-deck/raw/aroll/clip01.mp4',
        contents: 'contenido-del-clip',
        sizeBytes: 12_345,
        modifiedAtMs: 1_700_000_000_000,
      },
      {
        path: '/tmp/media/pitch-deck/work/whisper/aroll/clip01.json',
        contents: WHISPER_RAW_OUTPUT,
      },
      {
        path: '/tmp/media/pitch-deck/work/catalog.json',
        contents: 'esto no es json',
      },
    ]);

    const deps: IngestDependencies = {
      runner: activeRunner(),
      readDirectory: fakeFileSystem.directoryReader,
      statFile: fakeFileSystem.fileStatReader,
      readTextFile: fakeFileSystem.readTextFile,
      writeTextFile: fakeFileSystem.writeTextFile,
      ensureDirectory: fakeFileSystem.ensureDirectory,
    };

    const result = await ingestProject(project, { binaries }, deps);

    expect(result.staleCatalogReplaced).toBe(true);
    expect(result.transcribedAssetIds).toEqual(['raw/aroll/clip01.mp4']);
    expect(result.catalog.assets).toHaveLength(1);
  });
});

describe('ingestProject — fallo de probe (CA-002 / RN-02)', () => {
  it('un asset cuyo probe falla no aborta la ingesta y aparece como AssetProbeFailedError', async () => {
    const fakeFileSystem = createFakeFileSystem([
      {
        path: '/tmp/media/pitch-deck/raw/aroll/clip01.mp4',
        contents: 'contenido-roto',
        sizeBytes: 1,
        modifiedAtMs: 1,
      },
    ]);

    const runner = new FixtureCommandRunner([
      { bin: 'ffprobe', response: { stdout: '', stderr: 'archivo corrupto', exitCode: 1 } },
    ]);

    const deps: IngestDependencies = {
      runner,
      readDirectory: fakeFileSystem.directoryReader,
      statFile: fakeFileSystem.fileStatReader,
      readTextFile: fakeFileSystem.readTextFile,
      writeTextFile: fakeFileSystem.writeTextFile,
      ensureDirectory: fakeFileSystem.ensureDirectory,
    };

    const result = await ingestProject(project, { binaries }, deps);

    expect(result.catalog.assets).toEqual([]);
    expect(result.probeFailures).toHaveLength(1);
    expect(result.probeFailures[0]).toBeInstanceOf(AssetProbeFailedError);
    expect(result.probeFailures[0]?.path).toBe('raw/aroll/clip01.mp4');
    expect(result.catalog.probeFailures).toHaveLength(1);
    expect(result.catalog.probeFailures[0]?.errorCode).toBe('COMMAND_FAILED');
  });
});
