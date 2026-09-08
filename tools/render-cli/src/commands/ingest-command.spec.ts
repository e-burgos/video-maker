import type { DirectoryReader } from '@video-maker/auto-montage';
import type { ResolvedBinaries } from '@video-maker/media-local';
import { BinaryNotFoundError, FixtureCommandRunner, UnparseableOutputError } from '@video-maker/media-local';
import { describe, expect, it } from 'vitest';

import { createFakeCliDependencies, createFakeFileSystem } from '../__fixtures__/fake-cli-dependencies';
import { fixtureMediaProject } from '../__fixtures__/media-project';
import { StageFailedError } from '../errors/stage-failed-error';
import { StageInputMissingError } from '../errors/stage-input-missing-error';

import { ingestCommand } from './ingest-command';

const BINARIES: ResolvedBinaries = {
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

function buildIngestableFileSystem() {
  return createFakeFileSystem([
    {
      path: `${fixtureMediaProject.rawDir}/aroll/clip01.mp4`,
      contents: 'contenido-del-clip',
      sizeBytes: 12_345,
      modifiedAtMs: 1_700_000_000_000,
    },
    {
      path: `${fixtureMediaProject.workDir}/whisper/aroll/clip01.json`,
      contents: WHISPER_RAW_OUTPUT,
    },
  ]);
}

function successfulRunner(): FixtureCommandRunner {
  return new FixtureCommandRunner([
    { bin: 'ffprobe', response: { stdout: VIDEO_STDOUT, exitCode: 0 } },
    { bin: 'ffmpeg', response: { exitCode: 0 } },
    { bin: 'whisper-cli', response: { exitCode: 0 } },
  ]);
}

describe('ingestCommand', () => {
  it('propagates assertProjectIsIngestable when the project root does not exist', async () => {
    const deps = createFakeCliDependencies({ fileSystem: createFakeFileSystem([]) });

    await expect(ingestCommand(fixtureMediaProject, deps)).rejects.toBeInstanceOf(StageInputMissingError);
  });

  it('translates a resolveBinaries failure to a StageFailedError with stage ingest and the binary as resource (D-31)', async () => {
    const binaryNotFound = new BinaryNotFoundError({ binary: 'whisper-cli' });

    const deps = createFakeCliDependencies({
      fileSystem: buildIngestableFileSystem(),
      resolveBinaries: async () => {
        throw binaryNotFound;
      },
    });

    const error = await ingestCommand(fixtureMediaProject, deps).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(StageFailedError);
    expect((error as StageFailedError).stage).toBe('ingest');
    expect((error as StageFailedError).reason).toBe('BINARY_NOT_FOUND');
    expect((error as StageFailedError).resource).toBe('whisper-cli');
  });

  it('rethrows an untyped resolveBinaries failure unchanged (no resource to extract)', async () => {
    const deps = createFakeCliDependencies({
      fileSystem: buildIngestableFileSystem(),
      resolveBinaries: async () => {
        throw 'not-an-error-object';
      },
    });

    await expect(ingestCommand(fixtureMediaProject, deps)).rejects.toBe('not-an-error-object');
  });

  it('wraps a typed media-local failure without a .binary field with resource null', async () => {
    const deps = createFakeCliDependencies({
      fileSystem: buildIngestableFileSystem(),
      resolveBinaries: async () => {
        throw new UnparseableOutputError({ command: 'ffprobe', reason: 'invalid-json', sample: '{' });
      },
    });

    const error = await ingestCommand(fixtureMediaProject, deps).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(StageFailedError);
    expect((error as StageFailedError).reason).toBe('UNPARSEABLE_OUTPUT');
    expect((error as StageFailedError).resource).toBeNull();
  });

  it('resolveBinaries is the only call made before ingestProject runs (D-31: plan/render never resolve binaries)', async () => {
    let resolveBinariesCalls = 0;
    const deps = createFakeCliDependencies({
      fileSystem: buildIngestableFileSystem(),
      runner: successfulRunner(),
      resolveBinaries: async () => {
        resolveBinariesCalls += 1;
        return BINARIES;
      },
    });

    await ingestCommand(fixtureMediaProject, deps);

    expect(resolveBinariesCalls).toBe(1);
  });

  it('runs ingestProject for real and maps a clean result to an IngestReport', async () => {
    const deps = createFakeCliDependencies({
      fileSystem: buildIngestableFileSystem(),
      runner: successfulRunner(),
      resolveBinaries: async () => BINARIES,
    });

    const report = await ingestCommand(fixtureMediaProject, deps);

    expect(report.kind).toBe('ingest');
    expect(report.catalogPath).toBe('work/catalog.json');
    expect(report.assetCounts).toEqual([
      { role: 'aroll', count: 1 },
      { role: 'broll', count: 0 },
      { role: 'image', count: 0 },
      { role: 'audio', count: 0 },
    ]);
    expect(report.transcribedCount).toBe(1);
    expect(report.probeFailurePaths).toEqual([]);
    expect(report.transcriptionFailures).toEqual([]);
  });

  it('translates a ProjectLayoutError thrown by ingestProject itself to a StageFailedError with stage ingest', async () => {
    // Fails the second readDirectory(raw/) call so the precondition passes but ingestProject's own discoverAssets aborts for real.
    const fileSystem = buildIngestableFileSystem();
    const callCountByPath = new Map<string, number>();
    const flakyReadDirectory: DirectoryReader = {
      readDirectory: async (path) => {
        const count = (callCountByPath.get(path) ?? 0) + 1;
        callCountByPath.set(path, count);
        if (path === fixtureMediaProject.rawDir && count > 1) {
          throw new Error('simulated transient failure reading raw/ a second time');
        }
        return fileSystem.readDirectory.readDirectory(path);
      },
    };

    const deps = createFakeCliDependencies({
      fileSystem: { ...fileSystem, readDirectory: flakyReadDirectory },
      runner: successfulRunner(),
      resolveBinaries: async () => BINARIES,
    });

    const error = await ingestCommand(fixtureMediaProject, deps).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(StageFailedError);
    expect((error as StageFailedError).stage).toBe('ingest');
    expect((error as StageFailedError).reason).toBe('PROJECT_LAYOUT_INVALID');
  });

  it('resolves with the probe failure in the report instead of throwing (RN-27)', async () => {
    const failingRunner = new FixtureCommandRunner([
      { bin: 'ffprobe', response: { stdout: '', stderr: 'archivo corrupto', exitCode: 1 } },
      { bin: 'ffmpeg', response: { exitCode: 0 } },
      { bin: 'whisper-cli', response: { exitCode: 0 } },
    ]);
    const deps = createFakeCliDependencies({
      fileSystem: buildIngestableFileSystem(),
      runner: failingRunner,
      resolveBinaries: async () => BINARIES,
    });

    const report = await ingestCommand(fixtureMediaProject, deps);

    expect(report.kind).toBe('ingest');
    expect(report.probeFailurePaths).toEqual(['raw/aroll/clip01.mp4']);
  });
});
