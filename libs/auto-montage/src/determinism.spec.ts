import type { Clock, ResolvedBinaries } from '@video-maker/media-local';
import { FixtureCommandRunner } from '@video-maker/media-local';
import {
  EditDecisionListSchema,
  TimelineSchema,
  buildTimeline,
  defaultFormat,
} from '@video-maker/timeline-core';
import type { EditDecisionList, MediaAsset } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { autoMontage } from './auto-montage';
import type { AutoMontageOptions } from './auto-montage';
import { createFakeFileSystem } from './__fixtures__/fake-file-system';
import type { FakeFileSystemFileInit } from './__fixtures__/fake-file-system';
import { ingestProject } from './ingest/ingest-project';
import type { IngestDependencies } from './ingest/ingest-project';
import { serializeMontageDocument } from './montage/serialize-montage-document';
import { resolveMediaProject } from './project/media-project';

const project = resolveMediaProject('/tmp/media/determinism-project');

const binaries: ResolvedBinaries = {
  ffmpeg: 'ffmpeg',
  ffprobe: 'ffprobe',
  whisperCli: 'whisper-cli',
  whisperModel: '/models/ggml-base.bin',
};

const FIXED_CLOCK: Clock = { nowIso: () => '2026-01-01T00:00:00.000Z' };

function ffprobeStdout(durationSeconds: string): string {
  return JSON.stringify({
    streams: [
      {
        index: 0,
        codec_name: 'h264',
        codec_type: 'video',
        width: 1280,
        height: 720,
        r_frame_rate: '30/1',
        avg_frame_rate: '30/1',
        duration: durationSeconds,
      },
    ],
    format: { filename: 'clip01.mp4', format_name: 'mov,mp4,m4a,3gp,3g2,mj2', duration: durationSeconds },
  });
}

const WHISPER_RAW_OUTPUT = JSON.stringify({
  transcription: [
    { offsets: { from: 0, to: 300 }, text: ' hola' },
    { offsets: { from: 300, to: 600 }, text: ' vamos' },
    { offsets: { from: 1200, to: 1500 }, text: ' terminal' },
    { offsets: { from: 1500, to: 1800 }, text: ' gracias' },
    { offsets: { from: 2400, to: 2700 }, text: ' listo' },
    { offsets: { from: 2700, to: 3000 }, text: ' chau' },
  ],
});

function activeRunner(): FixtureCommandRunner {
  return new FixtureCommandRunner([
    { bin: 'ffprobe', response: { stdout: ffprobeStdout('8.000000'), exitCode: 0 } },
    { bin: 'ffmpeg', response: { exitCode: 0 } },
    { bin: 'whisper-cli', response: { exitCode: 0 } },
  ]);
}

function baseFiles(): FakeFileSystemFileInit[] {
  return [
    {
      path: '/tmp/media/determinism-project/raw/aroll/clip01.mp4',
      contents: 'contenido-del-aroll',
      sizeBytes: 12_345,
      modifiedAtMs: 1_700_000_000_000,
    },
    {
      path: '/tmp/media/determinism-project/raw/broll/terminal.mp4',
      contents: 'contenido-del-broll-terminal',
      sizeBytes: 9000,
      modifiedAtMs: 1_700_000_000_000,
    },
    {
      path: '/tmp/media/determinism-project/raw/broll/otro.mp4',
      contents: 'contenido-del-broll-otro',
      sizeBytes: 9000,
      modifiedAtMs: 1_700_000_000_000,
    },
    {
      path: '/tmp/media/determinism-project/work/whisper/aroll/clip01.json',
      contents: WHISPER_RAW_OUTPUT,
    },
  ];
}

async function runFullPipeline(
  files: readonly FakeFileSystemFileInit[],
  options: AutoMontageOptions,
): Promise<{ edlText: string; timelineText: string }> {
  const fakeFileSystem = createFakeFileSystem([...files]);

  const ingestDeps: IngestDependencies = {
    runner: activeRunner(),
    readDirectory: fakeFileSystem.directoryReader,
    statFile: fakeFileSystem.fileStatReader,
    readTextFile: fakeFileSystem.readTextFile,
    writeTextFile: fakeFileSystem.writeTextFile,
    ensureDirectory: fakeFileSystem.ensureDirectory,
    clock: FIXED_CLOCK,
  };
  await ingestProject(project, { binaries }, ingestDeps);

  await autoMontage(project, options, {
    readTextFile: fakeFileSystem.readTextFile,
    writeTextFile: fakeFileSystem.writeTextFile,
    ensureDirectory: fakeFileSystem.ensureDirectory,
  });

  const edlText = fakeFileSystem.readFile('/tmp/media/determinism-project/work/edl.json');
  const timelineText = fakeFileSystem.readFile('/tmp/media/determinism-project/work/timeline.json');
  if (edlText === undefined || timelineText === undefined) {
    throw new Error('El pipeline no escribió edl.json/timeline.json.');
  }

  return { edlText, timelineText };
}

describe('determinismo byte a byte (CA-012, RN-18)', () => {
  it('dos corridas con el mismo proyecto, preset y seed producen edl.json y timeline.json idénticos byte a byte', async () => {
    const options: AutoMontageOptions = { preset: 'software-demo', seed: 42 };

    const first = await runFullPipeline(baseFiles(), options);
    const second = await runFullPipeline(baseFiles(), options);

    expect(second.timelineText).toBe(first.timelineText);
    expect(second.edlText).toBe(first.edlText);
  });

  it('cambiar el seed cambia el timeline.json resultante', async () => {
    const first = await runFullPipeline(baseFiles(), { preset: 'software-demo', seed: 42 });
    const second = await runFullPipeline(baseFiles(), { preset: 'software-demo', seed: 7 });

    expect(second.timelineText).not.toBe(first.timelineText);
  });

  it('cambiar el preset cambia el timeline.json resultante sobre el mismo proyecto (refuerzo de CA-010)', async () => {
    const first = await runFullPipeline(baseFiles(), { preset: 'software-demo', seed: 42 });
    const second = await runFullPipeline(baseFiles(), { preset: 'recipe', seed: 42 });

    expect(second.timelineText).not.toBe(first.timelineText);
  });

  it('el orden en que el filesystem de fixture devuelve los assets no afecta el resultado (D-13)', async () => {
    const inOrder = baseFiles();
    const reversed = [...baseFiles()].reverse();
    const options: AutoMontageOptions = { preset: 'software-demo', seed: 42 };

    const first = await runFullPipeline(inOrder, options);
    const second = await runFullPipeline(reversed, options);

    expect(second.timelineText).toBe(first.timelineText);
    expect(second.edlText).toBe(first.edlText);
  });
});

describe('orden de claves tras Schema.parse (D-18) — el invariante del que cuelga CA-012', () => {
  it('EditDecisionList: el orden de claves lo fija el schema, no el literal de construcción', () => {
    const edl: EditDecisionList = {
      decisions: [{ id: 'keep-0001', type: 'keep', startMs: 0, endMs: 5000 }],
      generatedBy: { tool: 'auto-montage', params: { preset: 'software-demo', seed: 1 } },
      format: defaultFormat('reels-9x16'),
      sourceAssetId: 'raw/aroll/camara.mp4',
      schemaVersion: 1,
    };

    const serialized = JSON.parse(serializeMontageDocument(EditDecisionListSchema.parse(edl)));

    expect(Object.keys(serialized)).toEqual([
      'schemaVersion',
      'sourceAssetId',
      'format',
      'generatedBy',
      'decisions',
    ]);
    expect(Object.keys(serialized.decisions[0])).toEqual(['id', 'type', 'startMs', 'endMs']);
  });

  it('Timeline: el orden de claves lo fija el schema, incluyendo tracks.aroll[0] donde vive "anchor" (D-4)', () => {
    const edl: EditDecisionList = {
      schemaVersion: 1,
      sourceAssetId: 'raw/aroll/camara.mp4',
      format: defaultFormat('reels-9x16'),
      generatedBy: { tool: 'auto-montage', params: { preset: 'software-demo', seed: 1 } },
      decisions: [
        { id: 'keep-0001', type: 'keep', startMs: 0, endMs: 5000 },
        {
          id: 'punch-0001',
          type: 'punch-in',
          startMs: 0,
          endMs: 5000,
          scale: 1.1,
          anchor: 'face-hint',
        },
      ],
    };
    const assets: MediaAsset[] = [
      {
        id: 'raw/aroll/camara.mp4',
        kind: 'video',
        path: 'raw/aroll/camara.mp4',
        durationMs: 10_000,
        fps: 30,
        width: 1920,
        height: 1080,
        hasAudio: true,
        probedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    const timeline = buildTimeline(edl, assets);

    const serialized = JSON.parse(serializeMontageDocument(TimelineSchema.parse(timeline)));

    expect(Object.keys(serialized)).toEqual([
      'schemaVersion',
      'id',
      'format',
      'durationFrames',
      'assets',
      'tracks',
      'transitions',
      'audioMix',
      'safeZone',
    ]);
    expect(Object.keys(serialized.tracks.aroll[0])).toEqual([
      'id',
      'assetId',
      'from',
      'durationFrames',
      'trimStartMs',
      'transform',
      'muted',
    ]);
    expect(serialized.tracks.aroll[0].transform.anchor).toBe('face-hint');
  });
});
