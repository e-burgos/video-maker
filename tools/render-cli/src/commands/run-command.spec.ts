import type { ResolvedBinaries } from '@video-maker/media-local';
import { FixtureCommandRunner } from '@video-maker/media-local';
import { describe, expect, it } from 'vitest';

import { createFakeCliDependencies, createFakeFileSystem } from '../__fixtures__/fake-cli-dependencies';
import type { FakeFileSystem } from '../__fixtures__/fake-cli-dependencies';
import { fixtureMediaProject } from '../__fixtures__/media-project';
import { StageInputMissingError } from '../errors/stage-input-missing-error';

import { runCommand } from './run-command';

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
      duration: '12.000000',
    },
  ],
  format: { filename: 'demo.mp4', format_name: 'mov,mp4,m4a,3gp,3g2,mj2', duration: '12.000000' },
});

function whisperToken(text: string, fromMs: number, toMs: number) {
  return { offsets: { from: fromMs, to: toMs }, text: ` ${text}` };
}

const WHISPER_RAW_OUTPUT = JSON.stringify({
  transcription: [
    whisperToken('hola', 0, 300),
    whisperToken('vamos', 300, 600),
    whisperToken('a', 600, 700),
    whisperToken('abrir', 700, 1000),
    whisperToken('la', 1600, 1700),
    whisperToken('terminal', 1700, 2200),
    whisperToken('y', 2200, 2300),
    whisperToken('ejecutamos', 2300, 2800),
    whisperToken('el', 2900, 3000),
    whisperToken('comando', 3000, 3500),
    whisperToken('listo', 3500, 3800),
  ],
});

function buildRunnableFileSystem(): FakeFileSystem {
  return createFakeFileSystem([
    {
      path: `${fixtureMediaProject.rawDir}/aroll/demo.mp4`,
      contents: 'contenido-del-clip',
      sizeBytes: 12_345,
      modifiedAtMs: 1_700_000_000_000,
    },
    {
      path: `${fixtureMediaProject.workDir}/whisper/aroll/demo.json`,
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

describe('runCommand', () => {
  it('cuts at the first failing stage and reports that stage, never "run" (RN-21)', async () => {
    const deps = createFakeCliDependencies({ fileSystem: createFakeFileSystem([]) });

    const error = await runCommand(fixtureMediaProject, { preset: 'software-demo', seed: 0, scriptPath: null, logo: 'auto', format: 'reels-9x16' }, deps).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(StageInputMissingError);
    expect((error as StageInputMissingError).stage).toBe('ingest');
  });

  it('runs ingest, plan and render in strict sequence, re-reading work/timeline.json from disk for render (D-29)', async () => {
    const fileSystem = buildRunnableFileSystem();
    const readTextFileCalls: string[] = [];
    const spiedFileSystem: FakeFileSystem = {
      ...fileSystem,
      readTextFile: async (path) => {
        readTextFileCalls.push(path);
        return fileSystem.readTextFile(path);
      },
    };

    const deps = createFakeCliDependencies({
      fileSystem: spiedFileSystem,
      runner: successfulRunner(),
      resolveBinaries: async () => BINARIES,
      renderTimeline: async (_timeline, request) => ({
        outPath: request.outPath,
        width: 1080,
        height: 1920,
        fps: 30,
        durationInFrames: 556,
      }),
    });

    const report = await runCommand(fixtureMediaProject, { preset: 'software-demo', seed: 42, scriptPath: null, logo: 'auto', format: 'reels-9x16' }, deps);

    expect(report.kind).toBe('run');
    expect(report.ingest.kind).toBe('ingest');
    expect(report.plan.kind).toBe('plan');
    expect(report.render.kind).toBe('render');
    expect(report.render.outPath).toBe(`out/${fixtureMediaProject.slug}.mp4`);

    const timelinePath = `${fixtureMediaProject.workDir}/timeline.json`;
    expect(readTextFileCalls).toContain(timelinePath);
  });
});
