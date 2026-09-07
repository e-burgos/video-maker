import type { ReadTextFile } from '@video-maker/media-local';
import { FixtureCommandRunner } from '@video-maker/media-local';
import { describe, expect, it } from 'vitest';

import { resolveMediaProject } from '../project/media-project';
import type { TranscriptionPlanEntry } from './plan-ingest-work';
import { transcribeAssets } from './transcribe-assets';

const project = resolveMediaProject('/tmp/media/pitch-deck');

const WHISPER_RAW_OUTPUT = JSON.stringify({
  transcription: [
    { offsets: { from: 0, to: 500 }, text: ' Hola' },
    { offsets: { from: 520, to: 900 }, text: ' mundo' },
  ],
});

function readTextFileStub(entries: Record<string, string>): ReadTextFile {
  return (path) => {
    const content = entries[path];
    return content === undefined ? Promise.reject(new Error(`no existe: ${path}`)) : Promise.resolve(content);
  };
}

function writeTextFileRecorder() {
  const written = new Map<string, string>();
  const writeTextFile = (path: string, contents: string): Promise<void> => {
    written.set(path, contents);
    return Promise.resolve();
  };
  return { writeTextFile, written };
}

function noopEnsureDirectory(): Promise<void> {
  return Promise.resolve();
}

function plan(overrides: Partial<TranscriptionPlanEntry> = {}): TranscriptionPlanEntry {
  return {
    assetId: 'raw/aroll/clip01.mp4',
    fingerprint: { sizeBytes: 1_000, modifiedAtMs: 1_000 },
    reuseCandidate: undefined,
    ...overrides,
  };
}

const validPreviousTranscription = JSON.stringify({
  assetId: 'raw/aroll/clip01.mp4',
  engine: 'whisper.cpp',
  model: 'ggml-base.bin',
  language: 'es',
  words: [],
  segments: [],
});

const previousTranscriptRef = {
  assetId: 'raw/aroll/clip01.mp4',
  transcriptPath: 'work/transcripts/aroll/clip01.json',
  fingerprint: { sizeBytes: 1_000, modifiedAtMs: 1_000 },
  engine: 'whisper.cpp' as const,
  model: 'ggml-base.bin',
  language: 'es',
};

describe('transcribeAssets — reuso (CA-004)', () => {
  it('reusa un candidato cuyo .json existe y parsea, y no invoca whisper-cli ni ffmpeg', async () => {
    const runner = new FixtureCommandRunner([]);
    const { writeTextFile, written } = writeTextFileRecorder();
    const readTextFile = readTextFileStub({
      '/tmp/media/pitch-deck/work/transcripts/aroll/clip01.json': validPreviousTranscription,
    });

    const result = await transcribeAssets(
      project,
      [plan({ reuseCandidate: previousTranscriptRef })],
      { runner, readTextFile, writeTextFile, ensureDirectory: noopEnsureDirectory },
      { modelPath: '/models/ggml-base.bin' },
    );

    expect(result.reusedAssetIds).toEqual(['raw/aroll/clip01.mp4']);
    expect(result.transcribedAssetIds).toEqual([]);
    expect(result.transcripts).toEqual([previousTranscriptRef]);
    expect(result.failures).toEqual([]);
    expect(runner.calls.length).toBe(0);
    expect(written.size).toBe(0);
  });
});

describe('transcribeAssets — invalidación del candidato (CA-005)', () => {
  it('re-transcribe si el .json del candidato no existe', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'ffmpeg', response: { exitCode: 0 } },
      {
        bin: 'whisper-cli',
        response: { stdout: '', exitCode: 0 },
      },
    ]);
    const { writeTextFile, written } = writeTextFileRecorder();
    const readTextFile = readTextFileStub({
      '/tmp/media/pitch-deck/work/whisper/aroll/clip01.json': WHISPER_RAW_OUTPUT,
    });

    const result = await transcribeAssets(
      project,
      [plan({ reuseCandidate: previousTranscriptRef })],
      { runner, readTextFile, writeTextFile, ensureDirectory: noopEnsureDirectory },
      { modelPath: '/models/ggml-base.bin', language: 'es' },
    );

    expect(result.reusedAssetIds).toEqual([]);
    expect(result.transcribedAssetIds).toEqual(['raw/aroll/clip01.mp4']);
    expect(result.failures).toEqual([]);
    expect(runner.callsFor('ffmpeg').length).toBe(1);
    expect(runner.callsFor('whisper-cli').length).toBe(1);
    expect(written.has('/tmp/media/pitch-deck/work/transcripts/aroll/clip01.json')).toBe(true);
  });

  it('re-transcribe si el .json del candidato existe pero no es JSON válido', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'ffmpeg', response: { exitCode: 0 } },
      { bin: 'whisper-cli', response: { stdout: '', exitCode: 0 } },
    ]);
    const { writeTextFile } = writeTextFileRecorder();
    const readTextFile = readTextFileStub({
      '/tmp/media/pitch-deck/work/transcripts/aroll/clip01.json': 'esto no es json',
      '/tmp/media/pitch-deck/work/whisper/aroll/clip01.json': WHISPER_RAW_OUTPUT,
    });

    const result = await transcribeAssets(
      project,
      [plan({ reuseCandidate: previousTranscriptRef })],
      { runner, readTextFile, writeTextFile, ensureDirectory: noopEnsureDirectory },
      { modelPath: '/models/ggml-base.bin' },
    );

    expect(result.reusedAssetIds).toEqual([]);
    expect(result.transcribedAssetIds).toEqual(['raw/aroll/clip01.mp4']);
  });

  it('re-transcribe si el .json del candidato parsea pero no cumple TranscriptionSchema', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'ffmpeg', response: { exitCode: 0 } },
      { bin: 'whisper-cli', response: { stdout: '', exitCode: 0 } },
    ]);
    const { writeTextFile } = writeTextFileRecorder();
    const readTextFile = readTextFileStub({
      '/tmp/media/pitch-deck/work/transcripts/aroll/clip01.json': JSON.stringify({ foo: 'bar' }),
      '/tmp/media/pitch-deck/work/whisper/aroll/clip01.json': WHISPER_RAW_OUTPUT,
    });

    const result = await transcribeAssets(
      project,
      [plan({ reuseCandidate: previousTranscriptRef })],
      { runner, readTextFile, writeTextFile, ensureDirectory: noopEnsureDirectory },
      { modelPath: '/models/ggml-base.bin' },
    );

    expect(result.reusedAssetIds).toEqual([]);
    expect(result.transcribedAssetIds).toEqual(['raw/aroll/clip01.mp4']);
  });
});

describe('transcribeAssets — transcripción fresca sin candidato', () => {
  it('extrae audio y transcribe, persistiendo un TranscriptRef con model y engine devueltos por whisper.cpp', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'ffmpeg', response: { exitCode: 0 } },
      { bin: 'whisper-cli', response: { exitCode: 0 } },
    ]);
    const { writeTextFile, written } = writeTextFileRecorder();
    const readTextFile = readTextFileStub({
      '/tmp/media/pitch-deck/work/whisper/aroll/clip01.json': WHISPER_RAW_OUTPUT,
    });

    const result = await transcribeAssets(
      project,
      [plan()],
      { runner, readTextFile, writeTextFile, ensureDirectory: noopEnsureDirectory },
      { modelPath: '/models/ggml-base.bin', language: 'es' },
    );

    expect(result.transcribedAssetIds).toEqual(['raw/aroll/clip01.mp4']);
    expect(result.failures).toEqual([]);
    expect(result.transcripts).toEqual([
      {
        assetId: 'raw/aroll/clip01.mp4',
        transcriptPath: 'work/transcripts/aroll/clip01.json',
        fingerprint: { sizeBytes: 1_000, modifiedAtMs: 1_000 },
        engine: 'whisper.cpp',
        model: 'ggml-base.bin',
        language: 'es',
      },
    ]);
    expect(written.get('/tmp/media/pitch-deck/work/transcripts/aroll/clip01.json')).toContain('"assetId"');
  });

  it('CA-002/RN-02 análogo: un fallo de extract-audio no aborta el resto y queda en failures con stage extract-audio', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'ffmpeg', response: { exitCode: 1, stderr: 'no se pudo leer el archivo' } },
    ]);
    const { writeTextFile } = writeTextFileRecorder();
    const readTextFile = readTextFileStub({});

    const result = await transcribeAssets(
      project,
      [plan()],
      { runner, readTextFile, writeTextFile, ensureDirectory: noopEnsureDirectory },
      { modelPath: '/models/ggml-base.bin' },
    );

    expect(result.transcribedAssetIds).toEqual([]);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.assetId).toBe('raw/aroll/clip01.mp4');
    expect(result.failures[0]?.stage).toBe('extract-audio');
  });

  it('un fallo de whisper-cli no aborta el resto y queda en failures con stage transcribe', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'ffmpeg', response: { exitCode: 0 } },
      { bin: 'whisper-cli', response: { exitCode: 1, stderr: 'modelo corrupto' } },
    ]);
    const { writeTextFile } = writeTextFileRecorder();
    const readTextFile = readTextFileStub({});

    const result = await transcribeAssets(
      project,
      [
        plan({ assetId: 'raw/aroll/clip01.mp4' }),
        plan({ assetId: 'raw/aroll/clip02.mp4', fingerprint: { sizeBytes: 2_000, modifiedAtMs: 2_000 } }),
      ],
      { runner, readTextFile, writeTextFile, ensureDirectory: noopEnsureDirectory },
      { modelPath: '/models/ggml-base.bin' },
    );

    expect(result.failures.map((failure) => failure.assetId)).toEqual([
      'raw/aroll/clip01.mp4',
      'raw/aroll/clip02.mp4',
    ]);
    expect(result.failures.every((failure) => failure.stage === 'transcribe')).toBe(true);
  });
});
