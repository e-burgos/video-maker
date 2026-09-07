import { describe, expect, it } from 'vitest';

import type { MediaAsset } from '@video-maker/timeline-core';

import { readFixture } from '../__fixtures__/load-fixture';
import { UnparseableOutputError } from '../errors/unparseable-output-error';
import { FixtureCommandRunner } from '../runner/fixture-command-runner';
import { classifyKind, parseFfprobeJson, resolveRotation } from './parse-ffprobe-json';
import { FFPROBE_ARGS, probeMedia } from './probe-media';

const PROBED_AT = '2026-09-07T00:00:00.000Z';
const PATH = '/fixtures/aroll-cam-01.mp4';

const videoRotatedRaw = readFixture('ffprobe/video-rotated.json');
const imageRaw = readFixture('ffprobe/image.json');
const audioRaw = readFixture('ffprobe/audio.json');

function withoutKeys(source: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const copy = { ...source };
  for (const key of keys) {
    delete copy[key];
  }
  return copy;
}

function withoutSideDataList(raw: string): string {
  const parsed = JSON.parse(raw) as { streams: Array<Record<string, unknown>> };
  const [videoStream, ...rest] = parsed.streams;
  const videoWithoutSideData = withoutKeys(videoStream as Record<string, unknown>, ['side_data_list']);
  return JSON.stringify({ ...parsed, streams: [videoWithoutSideData, ...rest] });
}

function withoutAnyRotationHint(raw: string): string {
  const parsed = JSON.parse(raw) as { streams: Array<Record<string, unknown>> };
  const [videoStream, ...rest] = parsed.streams;
  const videoWithoutRotation = withoutKeys(videoStream as Record<string, unknown>, ['side_data_list', 'tags']);
  return JSON.stringify({ ...parsed, streams: [videoWithoutRotation, ...rest] });
}

function withSideDataMissingRotation(raw: string): string {
  const parsed = JSON.parse(raw) as { streams: Array<Record<string, unknown>> };
  const [videoStream, ...rest] = parsed.streams;
  const patchedVideoStream = {
    ...(videoStream as Record<string, unknown>),
    side_data_list: [{ side_data_type: 'Content light level metadata' }],
  };
  return JSON.stringify({ ...parsed, streams: [patchedVideoStream, ...rest] });
}

describe('parseFfprobeJson — video rotado', () => {
  const expectedAsset: MediaAsset = {
    id: 'aroll-cam-01.mp4',
    kind: 'video',
    path: PATH,
    durationMs: 10000,
    fps: 30,
    width: 1080,
    height: 1920,
    rotation: 90,
    hasAudio: true,
    audio: { sampleRate: 48000, channels: 2, codec: 'aac' },
    videoCodec: 'h264',
    probedAt: PROBED_AT,
  };

  it('rota e intercambia width/height con side_data_list y tags.rotate presentes', () => {
    const asset = parseFfprobeJson(videoRotatedRaw, { path: PATH, probedAt: PROBED_AT });
    expect(asset).toEqual(expectedAsset);
  });

  it('produce el mismo MediaAsset usando solo tags.rotate, sin side_data_list', () => {
    const asset = parseFfprobeJson(withoutSideDataList(videoRotatedRaw), { path: PATH, probedAt: PROBED_AT });
    expect(asset).toEqual(expectedAsset);
  });

  it('no intercambia width/height cuando no hay ninguna fuente de rotación', () => {
    const asset = parseFfprobeJson(withoutAnyRotationHint(videoRotatedRaw), { path: PATH, probedAt: PROBED_AT });
    expect(asset.width).toBe(1920);
    expect(asset.height).toBe(1080);
    expect(asset.rotation).toBe(0);
  });

  it('cae al tag rotate cuando side_data_list existe pero ninguna entrada trae rotation', () => {
    const asset = parseFfprobeJson(withSideDataMissingRotation(videoRotatedRaw), {
      path: PATH,
      probedAt: PROBED_AT,
    });
    expect(asset.rotation).toBe(90);
    expect(asset.width).toBe(1080);
    expect(asset.height).toBe(1920);
  });
});

describe('parseFfprobeJson — imagen', () => {
  it('reporta kind image sin durationMs ni fps', () => {
    const asset = parseFfprobeJson(imageRaw, { path: '/fixtures/broll-shot-01.jpg', probedAt: PROBED_AT });

    expect(asset.kind).toBe('image');
    expect(asset.durationMs).toBe(0);
    expect('fps' in asset).toBe(false);
    expect(asset.hasAudio).toBe(false);
    expect(asset.width).toBe(1290);
    expect(asset.height).toBe(1720);
  });
});

describe('parseFfprobeJson — audio', () => {
  it('reporta kind audio con sus datos de sonido y sin campos de video', () => {
    const asset = parseFfprobeJson(audioRaw, { path: '/fixtures/voice-take-01.wav', probedAt: PROBED_AT });

    expect(asset.kind).toBe('audio');
    expect(asset.durationMs).toBe(8400);
    expect(asset.audio).toEqual({ sampleRate: 48000, channels: 1, codec: 'pcm_s16le' });
    expect('width' in asset).toBe(false);
  });
});

describe('parseFfprobeJson — salida inválida', () => {
  it('lanza UnparseableOutputError ante un JSON malformado, con command y sample', () => {
    expect.assertions(3);
    try {
      parseFfprobeJson('no soy json', { path: PATH, probedAt: PROBED_AT });
    } catch (error) {
      expect(error).toBeInstanceOf(UnparseableOutputError);
      expect((error as UnparseableOutputError).command).toBe('ffprobe');
      expect((error as UnparseableOutputError).sample.length).toBeGreaterThan(0);
    }
  });

  it('lanza UnparseableOutputError si no hay streams de video ni de audio', () => {
    expect(() => parseFfprobeJson('{"streams":[]}', { path: PATH, probedAt: PROBED_AT })).toThrow(
      UnparseableOutputError,
    );
  });

  it('lanza UnparseableOutputError si un stream no matchea el schema de ffprobe', () => {
    expect(() =>
      parseFfprobeJson('{"streams":[{"index":"no-es-un-numero"}]}', { path: PATH, probedAt: PROBED_AT }),
    ).toThrow(UnparseableOutputError);
  });

  it('lanza UnparseableOutputError si el MediaAsset construido no valida contra el dominio', () => {
    const parsed = JSON.parse(audioRaw) as { streams: Array<Record<string, unknown>> };
    const [audioStream, ...rest] = parsed.streams;
    const invalidAudioStream = { ...(audioStream as Record<string, unknown>), channels: 0 };
    const invalidRaw = JSON.stringify({ ...parsed, streams: [invalidAudioStream, ...rest] });

    expect(() => parseFfprobeJson(invalidRaw, { path: PATH, probedAt: PROBED_AT })).toThrow(
      UnparseableOutputError,
    );
  });
});

describe('resolveRotation', () => {
  it('devuelve 0 cuando no hay stream', () => {
    expect(resolveRotation(undefined)).toBe(0);
  });
});

describe('classifyKind', () => {
  it('lanza UnparseableOutputError sin videoStream ni audioStream', () => {
    expect(() => classifyKind(undefined, undefined, undefined, '{}')).toThrow(UnparseableOutputError);
  });
});

describe('probeMedia', () => {
  it('ejecuta ffprobe con los argumentos exactos y devuelve el MediaAsset validado', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'ffprobe', response: { stdout: videoRotatedRaw, exitCode: 0 } },
    ]);

    const asset = await probeMedia(PATH, runner, { probedAt: PROBED_AT });

    expect(runner.calls[0]?.args).toEqual([...FFPROBE_ARGS, PATH]);
    expect(asset.probedAt).toBe(PROBED_AT);
    expect(asset.kind).toBe('video');
  });

  it('inyecta el reloj cuando no se pasa probedAt explícito', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'ffprobe', response: { stdout: audioRaw, exitCode: 0 } }]);

    const asset = await probeMedia('/fixtures/voice-take-01.wav', runner, {
      clock: { nowIso: () => '2026-01-01T00:00:00.000Z' },
    });

    expect(asset.probedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('propaga CommandFailedError cuando ffprobe termina con exitCode distinto de 0', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'ffprobe', response: { exitCode: 1, stderr: 'boom' } }]);

    await expect(probeMedia(PATH, runner, { probedAt: PROBED_AT })).rejects.toMatchObject({
      code: 'COMMAND_FAILED',
      exitCode: 1,
    });
  });
});
