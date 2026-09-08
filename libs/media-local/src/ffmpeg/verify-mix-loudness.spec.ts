import { describe, expect, it } from 'vitest';

import type { VoiceTarget } from '@video-maker/timeline-core';

import { readFixture } from '../__fixtures__/load-fixture';
import { CommandFailedError } from '../errors/command-failed-error';
import { FixtureCommandRunner } from '../runner/fixture-command-runner';
import { DEFAULT_VOICE_TARGET } from './measure-loudness';
import {
  MIX_INTEGRATED_TOLERANCE_LU,
  MIX_TRUE_PEAK_TOLERANCE_DB,
  verifyMixLoudness,
} from './verify-mix-loudness';

const IN_TOLERANCE = readFixture('ffmpeg/loudnorm-mix-in-tolerance.stderr.txt');
const AT_BOUNDARY = readFixture('ffmpeg/loudnorm-mix-at-boundary.stderr.txt');
const INTEGRATED_OUT = readFixture('ffmpeg/loudnorm-mix-integrated-out.stderr.txt');
const TRUE_PEAK_OUT = readFixture('ffmpeg/loudnorm-mix-true-peak-out.stderr.txt');
const BOTH_OUT = readFixture('ffmpeg/loudnorm-mix-both-out.stderr.txt');

function runnerFor(stderr: string): FixtureCommandRunner {
  return new FixtureCommandRunner([{ bin: 'ffmpeg', response: { stderr, exitCode: 0 } }]);
}

describe('constantes de tolerancia (D-20, RN-4)', () => {
  it('son exactamente 1 LU de integrado y 0 dB de true peak', () => {
    expect(MIX_INTEGRATED_TOLERANCE_LU).toBe(1);
    expect(MIX_TRUE_PEAK_TOLERANCE_DB).toBe(0);
  });
});

describe('verifyMixLoudness — los cinco casos de §7.3 (CA-009)', () => {
  it('dentro de tolerancia: -13.62 LUFS / -1.42 dBTP -> delta +0.38 / -0.42, withinTolerance true', async () => {
    const runner = runnerFor(IN_TOLERANCE);

    const result = await verifyMixLoudness('/out/master.wav', DEFAULT_VOICE_TARGET, runner);

    expect(result.measured.integratedLufs).toBe(-13.62);
    expect(result.measured.truePeakDbtp).toBe(-1.42);
    expect(result.integratedDeltaLu).toBeCloseTo(0.38, 10);
    expect(result.truePeakDeltaDb).toBeCloseTo(-0.42, 10);
    expect(result.withinTolerance).toBe(true);
  });

  it('borde exacto (inclusivo): -15.00 LUFS / -1.00 dBTP -> delta -1.00 / 0.00 exactos en IEEE-754, withinTolerance true', async () => {
    const runner = runnerFor(AT_BOUNDARY);

    const result = await verifyMixLoudness('/out/master.wav', DEFAULT_VOICE_TARGET, runner);

    expect(result.measured.integratedLufs).toBe(-15);
    expect(result.measured.truePeakDbtp).toBe(-1);
    expect(result.integratedDeltaLu).toBe(-1);
    expect(result.truePeakDeltaDb).toBe(0);
    expect(result.withinTolerance).toBe(true);
  });

  it('fuera por integrado: -11.80 LUFS -> delta +2.20, withinTolerance false aunque el true peak este ok', async () => {
    const runner = runnerFor(INTEGRATED_OUT);

    const result = await verifyMixLoudness('/out/master.wav', DEFAULT_VOICE_TARGET, runner);

    expect(result.integratedDeltaLu).toBeCloseTo(2.2, 10);
    expect(result.truePeakDeltaDb).toBeCloseTo(-0.3, 10);
    expect(result.withinTolerance).toBe(false);
  });

  it('fuera por true peak: -0.40 dBTP -> delta +0.60 por encima del techo, withinTolerance false aunque el integrado este ok', async () => {
    const runner = runnerFor(TRUE_PEAK_OUT);

    const result = await verifyMixLoudness('/out/master.wav', DEFAULT_VOICE_TARGET, runner);

    expect(result.integratedDeltaLu).toBeCloseTo(-0.1, 10);
    expect(result.truePeakDeltaDb).toBeCloseTo(0.6, 10);
    expect(result.withinTolerance).toBe(false);
  });

  it('fuera por ambos: -16.30 LUFS / -0.10 dBTP -> withinTolerance false', async () => {
    const runner = runnerFor(BOTH_OUT);

    const result = await verifyMixLoudness('/out/master.wav', DEFAULT_VOICE_TARGET, runner);

    expect(result.integratedDeltaLu).toBeCloseTo(-2.3, 10);
    expect(result.truePeakDeltaDb).toBeCloseTo(0.9, 10);
    expect(result.withinTolerance).toBe(false);
  });

  it('ninguno de los cinco casos lanza (CA-4 del functional)', async () => {
    for (const stderr of [IN_TOLERANCE, AT_BOUNDARY, INTEGRATED_OUT, TRUE_PEAK_OUT, BOTH_OUT]) {
      const runner = runnerFor(stderr);
      await expect(verifyMixLoudness('/out/master.wav', DEFAULT_VOICE_TARGET, runner)).resolves.toBeDefined();
    }
  });
});

describe('verifyMixLoudness — reglas de §7.2', () => {
  it('true peak es techo, no banda: -1.42 dBTP (mas bajo que el objetivo) no es un fallo', async () => {
    const runner = runnerFor(IN_TOLERANCE);

    const result = await verifyMixLoudness('/out/master.wav', DEFAULT_VOICE_TARGET, runner);

    expect(result.truePeakDeltaDb).toBeLessThan(0);
    expect(result.withinTolerance).toBe(true);
  });

  it('loudnessRange se reporta en measured pero no participa de withinTolerance (RN-5)', async () => {
    const inToleranceResult = await verifyMixLoudness('/out/master.wav', DEFAULT_VOICE_TARGET, runnerFor(IN_TOLERANCE));
    const boundaryResult = await verifyMixLoudness('/out/master.wav', DEFAULT_VOICE_TARGET, runnerFor(AT_BOUNDARY));

    expect(inToleranceResult.measured.loudnessRange).toBe(8.1);
    expect(boundaryResult.measured.loudnessRange).toBe(9.4);
    expect(inToleranceResult.measured.loudnessRange).not.toBe(boundaryResult.measured.loudnessRange);
    expect(inToleranceResult.withinTolerance).toBe(true);
    expect(boundaryResult.withinTolerance).toBe(true);
  });

  it('nunca lanza por estar fuera de tolerancia, pero si propaga CommandFailedError del binario (RN-6/CE-2)', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'ffmpeg', response: { stderr: 'ffmpeg: Invalid data found when processing input', exitCode: 1 } },
    ]);

    await expect(verifyMixLoudness('/out/master.wav', DEFAULT_VOICE_TARGET, runner)).rejects.toBeInstanceOf(
      CommandFailedError,
    );
  });

  it('mide con -map 0:a:0 siempre (D-15), y el target sale del parametro, no de una constante (D-20)', async () => {
    const runner = runnerFor(IN_TOLERANCE);
    const nonDefaultTarget: VoiceTarget = { integratedLufs: -16, truePeakDbtp: -2, loudnessRange: 9 };

    await verifyMixLoudness('/out/master.wav', nonDefaultTarget, runner);

    expect(runner.calls[0]?.args).toEqual([
      '-hide_banner',
      '-nostats',
      '-i',
      '/out/master.wav',
      '-map',
      '0:a:0',
      '-af',
      'loudnorm=I=-16:TP=-2:LRA=9:print_format=json',
      '-f',
      'null',
      '-',
    ]);
  });

  it('respeta ffmpegPath y runOptions', async () => {
    const runner = new FixtureCommandRunner([
      { bin: '/opt/homebrew/bin/ffmpeg', response: { stderr: IN_TOLERANCE, exitCode: 0 } },
    ]);

    await verifyMixLoudness('/out/master.wav', DEFAULT_VOICE_TARGET, runner, {
      ffmpegPath: '/opt/homebrew/bin/ffmpeg',
      runOptions: { timeoutMs: 5000 },
    });

    expect(runner.calls[0]?.bin).toBe('/opt/homebrew/bin/ffmpeg');
    expect(runner.calls[0]?.opts).toEqual({ timeoutMs: 5000 });
  });
});
