import { resolveMediaProject } from '@video-maker/auto-montage';
import type { DirectoryReader, FileStatReader } from '@video-maker/auto-montage';
import type { ResolvedBinaries } from '@video-maker/media-local';
import { describe, expect, it } from 'vitest';

import type { CallLog } from '../__fixtures__/call-log';
import { createCallLog } from '../__fixtures__/call-log';
import { createFakeCommandRunner } from '../__fixtures__/fake-command-runner';
import { createFakeObjectStorage } from '../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import type { ObjectStorage } from '../deps/object-storage';
import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { isMontagePipelineCanceled } from './montage-pipeline-observer';
import type { MontagePipelineObserver } from './montage-pipeline-observer';
import type { MontageStage } from './render-job';
import { runMontagePipeline } from './run-montage-pipeline';
import type { MontagePipelineRequest } from './run-montage-pipeline';

const PROJECT_ROOT = '/var/data/media/acme-launch';
const PROJECT = resolveMediaProject(PROJECT_ROOT);

const BINARIES: ResolvedBinaries = {
  ffmpeg: '/opt/media-tools/bin/ffmpeg',
  ffprobe: '/opt/media-tools/bin/ffprobe',
  whisperCli: '/opt/media-tools/bin/whisper-cli',
  whisperModel: '/opt/media-tools/share/ggml-model.bin',
};

const VIDEO_PROBE_STDOUT = JSON.stringify({
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

function toDirectoryReader(storage: ObjectStorage): DirectoryReader {
  return {
    readDirectory: async (path) => {
      const entries = await storage.listDirectory(path);
      if (entries === null) {
        throw new Error(`ENOENT: ${path}`);
      }
      return entries;
    },
  };
}

function toFlakyDirectoryReader(storage: ObjectStorage, flakyPath: string, succeedsFor: number): DirectoryReader {
  let callsToFlakyPath = 0;
  return {
    readDirectory: async (path) => {
      if (path === flakyPath) {
        callsToFlakyPath += 1;
        if (callsToFlakyPath > succeedsFor) {
          throw new Error(`ENOENT (flaky): ${path}`);
        }
      }
      const entries = await storage.listDirectory(path);
      if (entries === null) {
        throw new Error(`ENOENT: ${path}`);
      }
      return entries;
    },
  };
}

function toFileStatReader(storage: ObjectStorage): FileStatReader {
  return {
    statFile: async (path) => {
      const stat = await storage.stat(path);
      if (stat === null) {
        throw new Error(`ENOENT: ${path}`);
      }
      return { sizeBytes: stat.sizeBytes, modifiedAtMs: stat.modifiedAtMs };
    },
  };
}

function activeCommandRunnerFactory(callLog: CallLog) {
  return async () =>
    createFakeCommandRunner(
      [
        { bin: BINARIES.ffprobe, response: { stdout: VIDEO_PROBE_STDOUT, exitCode: 0 } },
        { bin: BINARIES.ffmpeg, response: { exitCode: 0 } },
        { bin: BINARIES.whisperCli, response: { exitCode: 0 } },
      ],
      callLog,
    );
}

function buildIngestibleProjectDeps(
  callLog: CallLog,
  overrideReadDirectory?: DirectoryReader,
): RenderApiDependencies {
  const storage = createFakeObjectStorage(callLog, {
    files: [
      { path: `${PROJECT_ROOT}/raw/aroll/clip01.mp4`, contents: 'clip-bytes', modifiedAtMs: 1_700_000_000_000 },
      { path: `${PROJECT_ROOT}/work/whisper/aroll/clip01.json`, contents: WHISPER_RAW_OUTPUT },
    ],
  });

  return createFakeRenderApiDependencies(callLog, {
    storage,
    readDirectory: overrideReadDirectory ?? toDirectoryReader(storage),
    statFile: toFileStatReader(storage),
    ensureDirectory: storage.ensureDirectory,
    createCommandRunner: activeCommandRunnerFactory(callLog),
    resolveMontageBinaries: async () => BINARIES,
  });
}

function buildBrollOnlyProjectDeps(callLog: CallLog): RenderApiDependencies {
  const storage = createFakeObjectStorage(callLog, {
    files: [{ path: `${PROJECT_ROOT}/raw/broll/clip01.mp4`, contents: 'clip-bytes', modifiedAtMs: 1_700_000_000_000 }],
  });

  return createFakeRenderApiDependencies(callLog, {
    storage,
    readDirectory: toDirectoryReader(storage),
    statFile: toFileStatReader(storage),
    ensureDirectory: storage.ensureDirectory,
    createCommandRunner: activeCommandRunnerFactory(callLog),
    resolveMontageBinaries: async () => BINARIES,
  });
}

function createRecordingObserver(cancellationRequested: () => boolean = () => false): {
  readonly observer: MontagePipelineObserver;
  readonly stages: readonly MontageStage[];
} {
  const stages: MontageStage[] = [];
  const observer: MontagePipelineObserver = {
    stageStarted: (stage) => stages.push(stage),
    assetProcessed: () => undefined,
    cancellationRequested,
  };
  return { observer, stages };
}

const REQUEST: MontagePipelineRequest = { project: PROJECT, preset: 'hardware', seed: 7 };

function writeTextFilePathsInOrder(callLog: CallLog): readonly string[] {
  return callLog
    .entries()
    .filter((entry) => entry.port === 'writeTextFile')
    .map((entry) => (entry.input as { path: string }).path);
}

describe('runMontagePipeline', () => {
  it('runs ingestProject fully (writes work/catalog.json) before autoMontage writes work/timeline.json', async () => {
    const callLog = createCallLog();
    const deps = buildIngestibleProjectDeps(callLog);
    const { observer } = createRecordingObserver();

    await runMontagePipeline(REQUEST, deps, observer);

    const writes = writeTextFilePathsInOrder(callLog);
    const catalogWriteIndex = writes.findIndex((path) => path.endsWith('work/catalog.json'));
    const timelineWriteIndex = writes.findIndex((path) => path.endsWith('work/timeline.json'));

    expect(catalogWriteIndex).toBeGreaterThanOrEqual(0);
    expect(timelineWriteIndex).toBeGreaterThan(catalogWriteIndex);
  });

  it('threads a non-default preset and seed through to the report', async () => {
    const callLog = createCallLog();
    const deps = buildIngestibleProjectDeps(callLog);
    const { observer } = createRecordingObserver();

    const report = await runMontagePipeline(REQUEST, deps, observer);

    expect(report.preset).toBe('hardware');
    expect(report.seed).toBe(7);
  });

  it('writes the timeline in the requested output format and defaults to vertical', async () => {
    async function timelineFormatOf(request: MontagePipelineRequest): Promise<unknown> {
      const callLog = createCallLog();
      const deps = buildIngestibleProjectDeps(callLog);
      const { observer } = createRecordingObserver();

      await runMontagePipeline(request, deps, observer);

      const write = callLog
        .entries()
        .filter((entry) => entry.port === 'writeTextFile')
        .map((entry) => entry.input as { path: string; contents: string })
        .find((entry) => entry.path.endsWith('work/timeline.json'));

      return JSON.parse(write?.contents ?? '{}').format;
    }

    expect(await timelineFormatOf({ ...REQUEST, format: 'youtube-16x9' })).toEqual({
      preset: 'youtube-16x9',
      width: 1920,
      height: 1080,
      fps: 30,
    });
    expect(await timelineFormatOf(REQUEST)).toEqual({
      preset: 'reels-9x16',
      width: 1080,
      height: 1920,
      fps: 30,
    });
  });

  it('reports the three project-relative paths written by ingestProject and autoMontage', async () => {
    const callLog = createCallLog();
    const deps = buildIngestibleProjectDeps(callLog);
    const { observer } = createRecordingObserver();

    const report = await runMontagePipeline(REQUEST, deps, observer);

    expect(report.catalogPath).toBe('work/catalog.json');
    expect(report.timelinePath).toBe('work/timeline.json');
    expect(report.editDecisionListPath).toBe('work/edl.json');
  });

  it('fails MONTAGE_RAW_MISSING without ever resolving a single binary when raw/ has no role directory', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog);
    const { observer } = createRecordingObserver();

    await expect(runMontagePipeline(REQUEST, deps, observer)).rejects.toMatchObject({
      code: 'MONTAGE_RAW_MISSING',
    });
    expect(callLog.ports()).not.toContain('createCommandRunner');
    expect(callLog.ports()).not.toContain('resolveMontageBinaries');
    expect(callLog.ports()).not.toContain('commandRunner.run');
  });

  it('cancels at the discover checkpoint before resolving any binary, when cancellation is already requested', async () => {
    const callLog = createCallLog();
    const deps = buildIngestibleProjectDeps(callLog);
    const { observer } = createRecordingObserver(() => true);

    const error = await runMontagePipeline(REQUEST, deps, observer).catch((caught: unknown) => caught);

    expect(isMontagePipelineCanceled(error)).toBe(true);
    expect((error as { stage: MontageStage }).stage).toBe('discover');
    expect(callLog.ports()).not.toContain('createCommandRunner');
    expect(callLog.ports()).not.toContain('resolveMontageBinaries');
  });

  it('cancels at the plan checkpoint after ingest wrote the catalog but before autoMontage writes anything', async () => {
    const callLog = createCallLog();
    const deps = buildIngestibleProjectDeps(callLog);
    const { observer, stages } = createRecordingObserver(() => stages.includes('discover'));

    const error = await runMontagePipeline(REQUEST, deps, observer).catch((caught: unknown) => caught);

    expect(isMontagePipelineCanceled(error)).toBe(true);
    expect((error as { stage: MontageStage }).stage).toBe('plan');

    const writes = writeTextFilePathsInOrder(callLog);
    expect(writes.some((path) => path.endsWith('work/catalog.json'))).toBe(true);
    expect(writes.some((path) => path.endsWith('work/timeline.json'))).toBe(false);
    expect(writes.some((path) => path.endsWith('work/edl.json'))).toBe(false);
  });

  it('translates a real ingestProject failure through translateMontageError', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      files: [{ path: `${PROJECT_ROOT}/raw/aroll/clip01.mp4`, contents: 'clip-bytes' }],
    });
    const flakyReadDirectory = toFlakyDirectoryReader(storage, PROJECT.rawDir, 2);
    const deps = buildIngestibleProjectDeps(callLog, flakyReadDirectory);
    const { observer } = createRecordingObserver();

    const error = await runMontagePipeline(REQUEST, deps, observer).catch((caught: unknown) => caught);

    expect(isMontagePipelineCanceled(error)).toBe(false);
    expect((error as { code: string }).code).toBe('MONTAGE_FAILED');
  });

  it('translates a real autoMontage failure (no aroll asset) to MONTAGE_INPUT_INVALID', async () => {
    const callLog = createCallLog();
    const deps = buildBrollOnlyProjectDeps(callLog);
    const { observer } = createRecordingObserver();

    const error = await runMontagePipeline(REQUEST, deps, observer).catch((caught: unknown) => caught);

    expect(isMontagePipelineCanceled(error)).toBe(false);
    expect((error as { code: string }).code).toBe('MONTAGE_INPUT_INVALID');

    const writes = writeTextFilePathsInOrder(callLog);
    expect(writes.some((path) => path.endsWith('work/catalog.json'))).toBe(true);
  });
});

describe('runMontagePipeline — guion y logo (spec-014)', () => {
  it('sin guion el reporte no trae alineación ni logo', async () => {
    const callLog = createCallLog();
    const deps = buildIngestibleProjectDeps(callLog);
    const { observer } = createRecordingObserver();

    const report = await runMontagePipeline(REQUEST, deps, observer);

    expect(report.scriptAlignment).toBeNull();
    expect(report.logoAssetId).toBeNull();
  });

  it('con scriptText corrige las palabras y lo reporta', async () => {
    const callLog = createCallLog();
    const deps = buildIngestibleProjectDeps(callLog);
    const { observer } = createRecordingObserver();

    const report = await runMontagePipeline(
      { ...REQUEST, scriptText: 'hola vamos abrir terminal listo' },
      deps,
      observer,
    );

    expect(report.scriptAlignment).toEqual({
      replaced: 0,
      removed: 0,
      inserted: 0,
      dropped: 0,
      corrected: 0,
    });
  });

  it('lee el guion del proyecto cuando llega scriptPath', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      files: [
        { path: `${PROJECT_ROOT}/raw/aroll/clip01.mp4`, contents: 'clip-bytes', modifiedAtMs: 1_700_000_000_000 },
        { path: `${PROJECT_ROOT}/work/whisper/aroll/clip01.json`, contents: WHISPER_RAW_OUTPUT },
        {
          path: `${PROJECT_ROOT}/work/producer/script.txt`,
          contents: 'hola vamos abrir consola listo',
        },
      ],
    });
    const deps = createFakeRenderApiDependencies(callLog, {
      storage,
      readDirectory: toDirectoryReader(storage),
      statFile: toFileStatReader(storage),
      ensureDirectory: storage.ensureDirectory,
      createCommandRunner: activeCommandRunnerFactory(callLog),
      resolveMontageBinaries: async () => BINARIES,
    });
    const { observer } = createRecordingObserver();

    const report = await runMontagePipeline(
      { ...REQUEST, scriptPath: 'work/producer/script.txt' },
      deps,
      observer,
    );

    expect(report.scriptAlignment?.replaced).toBe(1);
  });

  it('MONTAGE_SCRIPT_NOT_FOUND cuando el scriptPath no existe', async () => {
    const callLog = createCallLog();
    const deps = buildIngestibleProjectDeps(callLog);
    const { observer } = createRecordingObserver();

    await expect(
      runMontagePipeline({ ...REQUEST, scriptPath: 'work/producer/no-existe.txt' }, deps, observer),
    ).rejects.toMatchObject({ code: 'MONTAGE_SCRIPT_NOT_FOUND', stage: 'plan' });
  });
});
