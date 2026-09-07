import { describe, expect, it } from 'vitest';

import type { MediaAsset } from '@video-maker/timeline-core';

import { readFixture } from '../__fixtures__/load-fixture';
import { UnparseableOutputError } from '../errors/unparseable-output-error';
import { FixtureCommandRunner } from '../runner/fixture-command-runner';
import type { FfprobeStream } from './ffprobe-output.schema';
import { classifyKind, parseFfprobeJson, parseRational, resolveRotation } from './parse-ffprobe-json';
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

describe('parseFfprobeJson — video rotado (CA-017)', () => {
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

describe('parseFfprobeJson — imagen (CA-017)', () => {
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

describe('parseFfprobeJson — audio (CA-017)', () => {
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

  it('lanza UnparseableOutputError cuando un video no declara fps/width/height', () => {
    const parsed = JSON.parse(videoRotatedRaw) as { streams: Array<Record<string, unknown>> };
    const [videoStream, ...rest] = parsed.streams;
    const strippedVideo = withoutKeys(videoStream as Record<string, unknown>, [
      'width',
      'height',
      'avg_frame_rate',
      'r_frame_rate',
    ]);
    const raw = JSON.stringify({ ...parsed, streams: [strippedVideo, ...rest] });

    expect(() => parseFfprobeJson(raw, { path: PATH, probedAt: PROBED_AT })).toThrow(UnparseableOutputError);
  });

  it('lanza UnparseableOutputError cuando falta la duración tanto en format como en el stream', () => {
    const parsed = JSON.parse(videoRotatedRaw) as {
      streams: Array<Record<string, unknown>>;
      format: Record<string, unknown>;
    };
    const [videoStream, ...rest] = parsed.streams;
    const strippedVideo = withoutKeys(videoStream as Record<string, unknown>, ['duration']);
    const strippedFormat = withoutKeys(parsed.format, ['duration']);
    const raw = JSON.stringify({ streams: [strippedVideo, ...rest], format: strippedFormat });

    expect(() => parseFfprobeJson(raw, { path: PATH, probedAt: PROBED_AT })).toThrow(UnparseableOutputError);
  });

  it('lanza UnparseableOutputError cuando la duración informada no es numérica', () => {
    const parsed = JSON.parse(audioRaw) as { format: Record<string, unknown> };
    const raw = JSON.stringify({ ...parsed, format: { ...parsed.format, duration: 'no-numero' } });

    expect(() =>
      parseFfprobeJson(raw, { path: '/fixtures/voice-take-01.wav', probedAt: PROBED_AT }),
    ).toThrow(UnparseableOutputError);
  });

  it('lanza UnparseableOutputError cuando el stream de audio no declara channels', () => {
    const parsed = JSON.parse(audioRaw) as { streams: Array<Record<string, unknown>> };
    const [audioStream, ...rest] = parsed.streams;
    const strippedAudio = withoutKeys(audioStream as Record<string, unknown>, ['channels']);
    const raw = JSON.stringify({ ...parsed, streams: [strippedAudio, ...rest] });

    expect(() =>
      parseFfprobeJson(raw, { path: '/fixtures/voice-take-01.wav', probedAt: PROBED_AT }),
    ).toThrow(UnparseableOutputError);
  });
});

describe('parseFfprobeJson — campos opcionales ausentes', () => {
  it('reporta un video sin audio ni videoCodec cuando el stream no los trae', () => {
    const parsed = JSON.parse(videoRotatedRaw) as { streams: Array<Record<string, unknown>> };
    const [videoStream] = parsed.streams;
    const strippedVideo = withoutKeys(videoStream as Record<string, unknown>, ['codec_name']);
    const raw = JSON.stringify({ ...parsed, streams: [strippedVideo] });

    const asset = parseFfprobeJson(raw, { path: PATH, probedAt: PROBED_AT });

    expect(asset.hasAudio).toBe(false);
    expect('audio' in asset).toBe(false);
    expect('videoCodec' in asset).toBe(false);
  });

  it('reporta un audio sin codec cuando el stream no lo trae', () => {
    const parsed = JSON.parse(audioRaw) as { streams: Array<Record<string, unknown>> };
    const [audioStream, ...rest] = parsed.streams;
    const strippedAudio = withoutKeys(audioStream as Record<string, unknown>, ['codec_name']);
    const raw = JSON.stringify({ ...parsed, streams: [strippedAudio, ...rest] });

    const asset = parseFfprobeJson(raw, { path: '/fixtures/voice-take-01.wav', probedAt: PROBED_AT });

    expect(asset.audio?.codec).toBeUndefined();
  });

  it('usa la duración del stream cuando format.duration no está presente', () => {
    const parsed = JSON.parse(audioRaw) as { format: Record<string, unknown> };
    const strippedFormat = withoutKeys(parsed.format, ['duration']);
    const raw = JSON.stringify({ ...parsed, format: strippedFormat });

    const asset = parseFfprobeJson(raw, { path: '/fixtures/voice-take-01.wav', probedAt: PROBED_AT });

    expect(asset.durationMs).toBe(8400);
  });

  it('reporta una imagen sin width/height cuando el stream no los trae', () => {
    const parsed = JSON.parse(imageRaw) as { streams: Array<Record<string, unknown>> };
    const [imageStream, ...rest] = parsed.streams;
    const stripped = withoutKeys(imageStream as Record<string, unknown>, ['width', 'height']);
    const raw = JSON.stringify({ ...parsed, streams: [stripped, ...rest] });

    const asset = parseFfprobeJson(raw, { path: '/fixtures/broll-shot-01.jpg', probedAt: PROBED_AT });

    expect('width' in asset).toBe(false);
    expect('height' in asset).toBe(false);
  });
});

describe('resolveRotation', () => {
  it('devuelve 0 cuando no hay stream', () => {
    expect(resolveRotation(undefined)).toBe(0);
  });

  it('devuelve 0 cuando la rotación de side_data no es múltiplo de 90', () => {
    const stream: FfprobeStream = { index: 0, side_data_list: [{ rotation: -45 }] };
    expect(resolveRotation(stream)).toBe(0);
  });

  it('devuelve 0 cuando el tag rotate no es múltiplo de 90 y no hay side_data', () => {
    const stream: FfprobeStream = { index: 0, tags: { rotate: '45' } };
    expect(resolveRotation(stream)).toBe(0);
  });
});

describe('classifyKind', () => {
  it('lanza UnparseableOutputError sin videoStream ni audioStream', () => {
    expect(() => classifyKind(undefined, undefined, undefined, '{}')).toThrow(UnparseableOutputError);
  });

  it('clasifica como image un stream de video de 1 frame sin fps aunque el format_name no sea de imagen', () => {
    const videoStream: FfprobeStream = { index: 0, codec_type: 'video', nb_frames: '1', avg_frame_rate: '0/0' };
    expect(classifyKind('mov,mp4,m4a,3gp,3g2,mj2', videoStream, undefined, '{}')).toBe('image');
  });
});

describe('parseRational', () => {
  it('devuelve undefined cuando el texto es undefined', () => {
    expect(parseRational(undefined)).toBeUndefined();
  });

  it('asume denominador 1 cuando el texto no trae "/"', () => {
    expect(parseRational('25')).toBe(25);
  });

  it('devuelve undefined cuando el numerador no es un número finito', () => {
    expect(parseRational('abc/2')).toBeUndefined();
  });

  it('devuelve undefined cuando el denominador es 0', () => {
    expect(parseRational('30/0')).toBeUndefined();
  });

  it('devuelve undefined cuando el numerador es <= 0', () => {
    expect(parseRational('0/1')).toBeUndefined();
  });
});

describe('probeMedia (CA-017)', () => {
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

  it('respeta un assetId explícito y usa systemClock cuando no se pasan probedAt ni clock', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'ffprobe', response: { stdout: audioRaw, exitCode: 0 } }]);

    const asset = await probeMedia('/fixtures/voice-take-01.wav', runner, { assetId: 'custom-id' });

    expect(asset.id).toBe('custom-id');
    expect(new Date(asset.probedAt).getTime()).not.toBeNaN();
  });
});
