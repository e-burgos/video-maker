import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CommandFailedError } from '../errors/command-failed-error';
import { FixtureCommandRunner } from '../runner/fixture-command-runner';
import { DEFAULT_VOICE_TARGET } from './measure-loudness';
import {
  AAC_PROBE_SUFFIX,
  ENCODER_TRUE_PEAK_HEADROOM_DB,
  buildMasterNormalizationGraph,
  masterLoudnessTarget,
  MASTER_NORMALIZATION_TEMP_SUFFIX,
  needsMasterNormalization,
  normalizeMasterLoudness,
} from './normalize-master-loudness';
import type { LoudnessMeasurement } from './parse-loudnorm-json';

function loudnormJson(inputI: number, inputTp: number): string {
  return JSON.stringify({
    input_i: String(inputI),
    input_tp: String(inputTp),
    input_lra: '9.00',
    input_thresh: '-28.50',
    output_i: '-14.00',
    output_tp: '-1.00',
    output_lra: '7.00',
    output_thresh: '-24.00',
    normalization_type: 'dynamic',
    target_offset: '0.10',
  });
}

const QUIET_MASTER: LoudnessMeasurement = {
  integratedLufs: -18.14,
  truePeakDbtp: -3.17,
  loudnessRange: 9,
  thresholdLufs: -28.5,
  targetOffsetDb: 0.1,
};

describe('needsMasterNormalization', () => {
  it('is true when the master is 4 LU below target', () => {
    expect(needsMasterNormalization(QUIET_MASTER, DEFAULT_VOICE_TARGET)).toBe(true);
  });

  it('is false when integrated loudness is within 0.5 LU and the true peak is under the ceiling', () => {
    expect(
      needsMasterNormalization({ ...QUIET_MASTER, integratedLufs: -14.3, truePeakDbtp: -1.5 }, DEFAULT_VOICE_TARGET),
    ).toBe(false);
  });

  it('is true when the true peak exceeds the target even if loudness is on target', () => {
    expect(
      needsMasterNormalization({ ...QUIET_MASTER, integratedLufs: -14, truePeakDbtp: -0.2 }, DEFAULT_VOICE_TARGET),
    ).toBe(true);
  });
});

describe('buildMasterNormalizationGraph', () => {
  it('runs a second-pass linear loudnorm with the measured master values and resamples to 48k', () => {
    const graph = buildMasterNormalizationGraph('/out/master.wav', DEFAULT_VOICE_TARGET, QUIET_MASTER);

    expect(graph.inputs).toEqual(['/out/master.wav']);
    expect(graph.chains[0]?.filters).toEqual([
      'loudnorm=I=-14:TP=-1:LRA=11:measured_I=-18.14:measured_TP=-3.17:measured_LRA=9.00:measured_thresh=-28.50:offset=0.10:linear=true:print_format=json',
      'aresample=48000',
    ]);
  });

  it('never closes the chain with atrim', () => {
    const graph = buildMasterNormalizationGraph('/out/master.wav', DEFAULT_VOICE_TARGET, QUIET_MASTER);

    expect(graph.chains[0]?.filters.join(',')).not.toContain('atrim');
  });
});

describe('normalizeMasterLoudness', () => {
  let directory: string;
  let masterPath: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'master-normalize-'));
    masterPath = join(directory, 'master.wav');
    await writeFile(masterPath, 'original');
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  function routes(masterLoudness: string, aacTruePeak: number, onNormalize?: () => void) {
    return [
      { bin: 'ffmpeg', argsPattern: [/\.aac-probe\.m4a$/u, 'null'], response: { stderr: loudnormJson(-14.1, aacTruePeak), exitCode: 0 } },
      { bin: 'ffmpeg', argsPattern: ['-c:a', 'aac'], response: { stderr: '', exitCode: 0 } },
      { bin: 'ffmpeg', argsPattern: ['-f', 'null'], response: { stderr: masterLoudness, exitCode: 0 } },
      {
        bin: 'ffmpeg',
        argsPattern: ['-filter_complex'],
        response: () => {
          writeFileSync(`${masterPath}${MASTER_NORMALIZATION_TEMP_SUFFIX}`, 'normalized');
          onNormalize?.();
          return { stderr: '', exitCode: 0 };
        },
      },
    ];
  }

  function normalizationCalls(runner: FixtureCommandRunner) {
    return runner.calls.filter((call) => call.args.includes('-filter_complex'));
  }

  it('leaves the master untouched when it is on target and stays under the ceiling after the AAC encode', async () => {
    const runner = new FixtureCommandRunner(routes(loudnormJson(-14.2, -1.6), -1.3));

    const result = await normalizeMasterLoudness(masterPath, DEFAULT_VOICE_TARGET, runner);

    expect(result).toMatchObject({ applied: false, truePeakRetried: false });
    expect(runner.calls.map((call) => call.args.includes('aac'))).toEqual([false, true, false]);
    expect(await readFile(masterPath, 'utf8')).toBe('original');
    expect(existsSync(`${masterPath}${AAC_PROBE_SUFFIX}`)).toBe(false);
  });

  it('measures, normalizes into a temp file and replaces the master when it is 4 LU low', async () => {
    const temporaryPath = `${masterPath}${MASTER_NORMALIZATION_TEMP_SUFFIX}`;
    const runner = new FixtureCommandRunner(routes(loudnormJson(-18.14, -3.17), -1.4));

    const result = await normalizeMasterLoudness(masterPath, DEFAULT_VOICE_TARGET, runner);

    expect(result).toMatchObject({ applied: true, truePeakRetried: false });
    expect(result.measuredBefore.integratedLufs).toBe(-18.14);
    const [pass] = normalizationCalls(runner);
    expect(pass?.args).toContain(masterPath);
    expect(pass?.args.at(-1)).toBe(temporaryPath);
    expect(pass?.args.join(' ')).toContain('measured_I=-18.14');
    expect(runner.calls.find((call) => call.args.includes('aac'))?.args).toContain(temporaryPath);
    expect(await readFile(masterPath, 'utf8')).toBe('normalized');
    expect(existsSync(temporaryPath)).toBe(false);
  });

  it('redoes the normalization once with the target lowered by what the AAC encode added plus a safety margin when it crosses -1 dBTP', async () => {
    const runner = new FixtureCommandRunner(routes(loudnormJson(-18.14, -3.17), 0.06));

    const result = await normalizeMasterLoudness(masterPath, DEFAULT_VOICE_TARGET, runner);

    expect(result).toMatchObject({ applied: true, truePeakRetried: true });
    const passes = normalizationCalls(runner);
    expect(passes).toHaveLength(2);
    expect(passes[0]?.args.join(' ')).toContain('TP=-1.5:');
    expect(passes[1]?.args.join(' ')).toContain('TP=-3.56:');
    expect(await readFile(masterPath, 'utf8')).toBe('normalized');
  });

  it('normalizes a master that was on target when only its AAC encode crosses the ceiling', async () => {
    const runner = new FixtureCommandRunner(routes(loudnormJson(-14.2, -1.6), -0.5));

    const result = await normalizeMasterLoudness(masterPath, DEFAULT_VOICE_TARGET, runner);

    expect(result).toMatchObject({ applied: true, truePeakRetried: true });
    const passes = normalizationCalls(runner);
    expect(passes).toHaveLength(1);
    expect(passes[0]?.args.join(' ')).toContain('TP=-3.1:');
    expect(await readFile(masterPath, 'utf8')).toBe('normalized');
  });

  it('throws CommandFailedError and keeps the original master when the normalization pass fails', async () => {
    const runner = new FixtureCommandRunner([
      {
        bin: 'ffmpeg',
        argsPattern: ['-f', 'null'],
        response: { stderr: loudnormJson(-18.14, -3.17), exitCode: 0 },
      },
      { bin: 'ffmpeg', argsPattern: ['-filter_complex'], response: { stderr: 'disk full', exitCode: 1 } },
    ]);

    await expect(normalizeMasterLoudness(masterPath, DEFAULT_VOICE_TARGET, runner)).rejects.toBeInstanceOf(
      CommandFailedError,
    );
    expect(await readFile(masterPath, 'utf8')).toBe('original');
  });
});

describe('masterLoudnessTarget', () => {
  it('keeps the loudness target and leaves true-peak headroom for the AAC encode of the deliverable', () => {
    const target = masterLoudnessTarget(DEFAULT_VOICE_TARGET);

    expect(target.integratedLufs).toBe(DEFAULT_VOICE_TARGET.integratedLufs);
    expect(target.truePeakDbtp).toBe(DEFAULT_VOICE_TARGET.truePeakDbtp - ENCODER_TRUE_PEAK_HEADROOM_DB);
  });
});
