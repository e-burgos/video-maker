import type { Clock, CommandRunner } from '@video-maker/media-local';
import { BinaryNotFoundError, FixtureCommandRunner, MissingMediaStreamError } from '@video-maker/media-local';
import { describe, expect, it } from 'vitest';

import { resolveMediaProject } from '../project/media-project';
import type { AssetFinding } from './discover-assets';
import { probeAssets } from './probe-assets';

const project = resolveMediaProject('/tmp/media/pitch-deck');

const fixedClock: Clock = { nowIso: () => '2026-01-01T00:00:00.000Z' };

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

const AUDIO_STDOUT = JSON.stringify({
  streams: [
    { index: 0, codec_name: 'pcm_s16le', codec_type: 'audio', sample_rate: '48000', channels: 1, duration: '8.400000' },
  ],
  format: { filename: 'music01.mp3', format_name: 'mp3', duration: '8.400000' },
});

function finding(relativePath: string, role: AssetFinding['role']): AssetFinding {
  return { relativePath, role, fingerprint: { sizeBytes: 1, modifiedAtMs: 0 } };
}

describe('probeAssets', () => {
  it('CA-002: un asset que falla no aborta el sondeo del resto', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'ffprobe', argsPattern: [/clip01\.mp4$/u], response: { stdout: VIDEO_STDOUT, exitCode: 0 } },
      { bin: 'ffprobe', argsPattern: [/music01\.mp3$/u], response: { stdout: AUDIO_STDOUT, exitCode: 0 } },
      {
        bin: 'ffprobe',
        argsPattern: [/clip02\.mov$/u],
        response: { stdout: '', stderr: 'no se pudo abrir el archivo', exitCode: 1 },
      },
    ]);

    const result = await probeAssets(
      project,
      [finding('raw/aroll/clip01.mp4', 'aroll'), finding('raw/broll/clip02.mov', 'broll'), finding('raw/audio/music01.mp3', 'audio')],
      { runner, clock: fixedClock },
    );

    expect(result.assets.map((probed) => probed.asset.id)).toEqual([
      'raw/aroll/clip01.mp4',
      'raw/audio/music01.mp3',
    ]);
    expect(result.failures).toEqual([
      {
        path: 'raw/broll/clip02.mov',
        errorCode: 'COMMAND_FAILED',
        message: expect.stringContaining('ffprobe'),
      },
    ]);
  });

  it('fija asset.id y asset.path a la ruta relativa del proyecto, no al basename', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'ffprobe', argsPattern: [/clip01\.mp4$/u], response: { stdout: VIDEO_STDOUT, exitCode: 0 } },
    ]);

    const result = await probeAssets(project, [finding('raw/aroll/clip01.mp4', 'aroll')], {
      runner,
      clock: fixedClock,
    });

    expect(result.assets).toEqual([
      {
        role: 'aroll',
        fingerprint: { sizeBytes: 1, modifiedAtMs: 0 },
        asset: expect.objectContaining({
          id: 'raw/aroll/clip01.mp4',
          path: 'raw/aroll/clip01.mp4',
          kind: 'video',
        }),
      },
    ]);
  });

  it('preserva role y fingerprint del finding original en el asset sondeado', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'ffprobe', argsPattern: [/clip01\.mp4$/u], response: { stdout: VIDEO_STDOUT, exitCode: 0 } },
    ]);

    const result = await probeAssets(
      project,
      [{ relativePath: 'raw/aroll/clip01.mp4', role: 'aroll', fingerprint: { sizeBytes: 42, modifiedAtMs: 99 } }],
      { runner, clock: fixedClock },
    );

    expect(result.assets[0]?.fingerprint).toEqual({ sizeBytes: 42, modifiedAtMs: 99 });
  });

  it('mapea BinaryNotFoundError a errorCode BINARY_NOT_FOUND', async () => {
    const runner: CommandRunner = {
      run: () => Promise.reject(new BinaryNotFoundError({ binary: 'ffprobe' })),
    };

    const result = await probeAssets(project, [finding('raw/aroll/clip01.mp4', 'aroll')], {
      runner,
      clock: fixedClock,
    });

    expect(result.failures).toEqual([
      { path: 'raw/aroll/clip01.mp4', errorCode: 'BINARY_NOT_FOUND', message: expect.any(String) },
    ]);
  });

  it('mapea una salida de ffprobe no parseable a errorCode UNPARSEABLE_OUTPUT', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'ffprobe', response: { stdout: 'esto no es json', exitCode: 0 } },
    ]);

    const result = await probeAssets(project, [finding('raw/aroll/clip01.mp4', 'aroll')], {
      runner,
      clock: fixedClock,
    });

    expect(result.failures).toEqual([
      { path: 'raw/aroll/clip01.mp4', errorCode: 'UNPARSEABLE_OUTPUT', message: expect.any(String) },
    ]);
  });

  it('mapea un error no reconocido a errorCode UNKNOWN', async () => {
    const runner: CommandRunner = {
      run: () => Promise.reject(new Error('algo inesperado')),
    };

    const result = await probeAssets(project, [finding('raw/aroll/clip01.mp4', 'aroll')], {
      runner,
      clock: fixedClock,
    });

    expect(result.failures).toEqual([
      { path: 'raw/aroll/clip01.mp4', errorCode: 'UNKNOWN', message: 'algo inesperado' },
    ]);
  });

  it('mapea un MediaLocalError con codigo ajeno al probe a errorCode UNKNOWN', async () => {
    const runner: CommandRunner = {
      run: () => Promise.reject(new MissingMediaStreamError({ path: 'raw/aroll/clip01.mp4', stream: 'audio' })),
    };

    const result = await probeAssets(project, [finding('raw/aroll/clip01.mp4', 'aroll')], {
      runner,
      clock: fixedClock,
    });

    expect(result.failures).toEqual([
      { path: 'raw/aroll/clip01.mp4', errorCode: 'UNKNOWN', message: expect.any(String) },
    ]);
  });

  it('ordena assets y failures de forma determinista por su ruta, sin importar el orden de entrada', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'ffprobe', argsPattern: [/clip01\.mp4$/u], response: { stdout: VIDEO_STDOUT, exitCode: 0 } },
      { bin: 'ffprobe', argsPattern: [/music01\.mp3$/u], response: { stdout: AUDIO_STDOUT, exitCode: 0 } },
    ]);

    const result = await probeAssets(
      project,
      [finding('raw/audio/music01.mp3', 'audio'), finding('raw/aroll/clip01.mp4', 'aroll')],
      { runner, clock: fixedClock },
    );

    expect(result.assets.map((probed) => probed.asset.id)).toEqual([
      'raw/aroll/clip01.mp4',
      'raw/audio/music01.mp3',
    ]);
  });

  it('mide el loudness integrado de un asset de rol audio y lo guarda en asset.audio (spec-014)', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'ffprobe', argsPattern: [/music01\.mp3$/u], response: { stdout: AUDIO_STDOUT, exitCode: 0 } },
      {
        bin: 'ffmpeg',
        argsPattern: [/music01\.mp3$/u],
        response: {
          stderr: `{
  "input_i" : "-22.30",
  "input_tp" : "-0.80",
  "input_lra" : "8.10",
  "input_thresh" : "-32.40",
  "target_offset" : "0.10"
}`,
          exitCode: 0,
        },
      },
    ]);

    const result = await probeAssets(project, [finding('raw/audio/music01.mp3', 'audio')], {
      runner,
      clock: fixedClock,
    });

    expect(result.assets[0]?.asset.audio?.integratedLufs).toBe(-22.3);
    expect(result.failures).toEqual([]);
  });

  it('no mide loudness para roles que no son audio', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'ffprobe', argsPattern: [/clip01\.mp4$/u], response: { stdout: VIDEO_STDOUT, exitCode: 0 } },
    ]);

    const result = await probeAssets(project, [finding('raw/aroll/clip01.mp4', 'aroll')], {
      runner,
      clock: fixedClock,
    });

    expect(result.assets[0]?.asset.audio?.integratedLufs).toBeUndefined();
    expect(runner.calls.every((call) => !call.bin.includes('ffmpeg'))).toBe(true);
  });

  it('una medición de loudness fallida no pierde el asset ni lo cuenta como probe failure', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'ffprobe', argsPattern: [/music01\.mp3$/u], response: { stdout: AUDIO_STDOUT, exitCode: 0 } },
      {
        bin: 'ffmpeg',
        argsPattern: [/music01\.mp3$/u],
        response: { stderr: 'ffmpeg exploded', exitCode: 1 },
      },
    ]);

    const result = await probeAssets(project, [finding('raw/audio/music01.mp3', 'audio')], {
      runner,
      clock: fixedClock,
    });

    expect(result.assets.map((probed) => probed.asset.id)).toEqual(['raw/audio/music01.mp3']);
    expect(result.assets[0]?.asset.audio?.integratedLufs).toBeUndefined();
    expect(result.failures).toEqual([]);
  });
});
