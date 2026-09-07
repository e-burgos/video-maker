import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { CommandFailedError } from '../errors/command-failed-error';
import { FixtureCommandRunner } from '../runner/fixture-command-runner';
import {
  DEFAULT_SILENCE_MIN_MS,
  DEFAULT_SILENCE_NOISE_DB,
  detectSilencesWithFfmpeg,
} from './detect-silences';
import { parseSilenceDetect } from './parse-silence-detect';

const silencedetectFixture = readFileSync(
  new URL('../__fixtures__/ffmpeg/silencedetect.stderr.txt', import.meta.url),
  'utf8',
);

const DURATION_MS = 10_000;

describe('parseSilenceDetect (CA-018)', () => {
  it('devuelve 3 rangos sobre la fixture, el ultimo cerrado en durationMs', () => {
    const ranges = parseSilenceDetect(silencedetectFixture, { durationMs: DURATION_MS });

    expect(ranges).toEqual([
      { startMs: 2180, endMs: 2680 },
      { startMs: 3860, endMs: 4660 },
      { startMs: 8720, endMs: 10_000 },
    ]);
    expect(ranges[2]?.endMs).toBe(DURATION_MS);
  });

  it('redondea segundos fraccionarios a milisegundos enteros', () => {
    const stderr = [
      '[silencedetect @ 0x1] silence_start: 1.004',
      '[silencedetect @ 0x1] silence_end: 1.2345 | silence_duration: 0.23',
    ].join('\n');

    expect(parseSilenceDetect(stderr, { durationMs: 5000 })).toEqual([{ startMs: 1004, endMs: 1235 }]);
  });

  it('clampea un silence_start negativo a 0', () => {
    const stderr = [
      '[silencedetect @ 0x1] silence_start: -0.018',
      '[silencedetect @ 0x1] silence_end: 1.0 | silence_duration: 1.018',
    ].join('\n');

    expect(parseSilenceDetect(stderr, { durationMs: 5000 })).toEqual([{ startMs: 0, endMs: 1000 }]);
  });

  it('devuelve [] cuando el stderr no tiene lineas de silencedetect', () => {
    expect(parseSilenceDetect('', { durationMs: DURATION_MS })).toEqual([]);
    expect(
      parseSilenceDetect('frame=  120 fps=30 q=-1.0 size=N/A time=00:00:04.00 bitrate=N/A speed=8x', {
        durationMs: DURATION_MS,
      }),
    ).toEqual([]);
  });

  it('cierra en durationMs un silence_start huerfano cuando llega otro silence_start sin end previo', () => {
    const stderr = [
      '[silencedetect @ 0x1] silence_start: 1.0',
      '[silencedetect @ 0x1] silence_start: 2.0',
      '[silencedetect @ 0x1] silence_end: 2.5 | silence_duration: 0.5',
    ].join('\n');

    expect(parseSilenceDetect(stderr, { durationMs: 10_000 })).toEqual([
      { startMs: 1000, endMs: 10_000 },
      { startMs: 2000, endMs: 2500 },
    ]);
  });

  it('descarta un rango degenerado (endMs <= startMs tras el clamp)', () => {
    const stderr = [
      '[silencedetect @ 0x1] silence_start: 9.9995',
      '[silencedetect @ 0x1] silence_end: 9.9996 | silence_duration: 0.0001',
    ].join('\n');

    expect(parseSilenceDetect(stderr, { durationMs: 10_000 })).toEqual([]);
  });
});

describe('detectSilencesWithFfmpeg (CA-018)', () => {
  it('llama a ffmpeg con los argumentos exactos de la tabla y devuelve lo mismo que el parser', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'ffmpeg', response: { stderr: silencedetectFixture, exitCode: 0 } },
    ]);

    const result = await detectSilencesWithFfmpeg('input.mp4', { durationMs: DURATION_MS }, runner);

    expect(runner.calls[0]?.args).toEqual([
      '-hide_banner',
      '-nostats',
      '-i',
      'input.mp4',
      '-af',
      'silencedetect=noise=-35dB:d=0.5',
      '-f',
      'null',
      '-',
    ]);
    expect(result).toEqual(parseSilenceDetect(silencedetectFixture, { durationMs: DURATION_MS }));
  });

  it('usa los defaults exportados cuando no se pasan noiseDb/minMs', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'ffmpeg', response: { stderr: '', exitCode: 0 } }]);

    await detectSilencesWithFfmpeg('input.mp4', { durationMs: DURATION_MS }, runner);

    expect(runner.calls[0]?.args[5]).toBe(
      `silencedetect=noise=${DEFAULT_SILENCE_NOISE_DB}dB:d=${DEFAULT_SILENCE_MIN_MS / 1000}`,
    );
  });

  it('construye el filtro con noiseDb y minMs no default', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'ffmpeg', response: { stderr: '', exitCode: 0 } }]);

    await detectSilencesWithFfmpeg(
      'input.mp4',
      { durationMs: DURATION_MS, noiseDb: -40, minMs: 1000 },
      runner,
    );

    expect(runner.calls[0]?.args).toEqual([
      '-hide_banner',
      '-nostats',
      '-i',
      'input.mp4',
      '-af',
      'silencedetect=noise=-40dB:d=1',
      '-f',
      'null',
      '-',
    ]);
  });

  it('propaga CommandFailedError cuando ffmpeg termina con exitCode distinto de 0', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'ffmpeg', response: { stderr: 'Invalid data found', exitCode: 1 } },
    ]);

    await expect(
      detectSilencesWithFfmpeg('input.mp4', { durationMs: DURATION_MS }, runner),
    ).rejects.toBeInstanceOf(CommandFailedError);
  });

  it('respeta ffmpegPath y runOptions', async () => {
    const runner = new FixtureCommandRunner([
      { bin: '/opt/homebrew/bin/ffmpeg', response: { stderr: '', exitCode: 0 } },
    ]);

    await detectSilencesWithFfmpeg(
      'input.mp4',
      { durationMs: DURATION_MS, ffmpegPath: '/opt/homebrew/bin/ffmpeg', runOptions: { timeoutMs: 5000 } },
      runner,
    );

    expect(runner.calls[0]?.bin).toBe('/opt/homebrew/bin/ffmpeg');
    expect(runner.calls[0]?.opts).toEqual({ timeoutMs: 5000 });
  });
});
