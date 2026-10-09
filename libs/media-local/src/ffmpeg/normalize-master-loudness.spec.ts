import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CommandFailedError } from '../errors/command-failed-error';
import { FixtureCommandRunner } from '../runner/fixture-command-runner';
import { DEFAULT_VOICE_TARGET } from './measure-loudness';
import {
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

  it('measures only and leaves the master untouched when it is already on target', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'ffmpeg', response: { stderr: loudnormJson(-14.2, -1.6), exitCode: 0 } },
    ]);

    const result = await normalizeMasterLoudness(masterPath, DEFAULT_VOICE_TARGET, runner);

    expect(result.applied).toBe(false);
    expect(runner.calls).toHaveLength(1);
    expect(await readFile(masterPath, 'utf8')).toBe('original');
  });

  it('measures, normalizes into a temp file and replaces the master when it is 4 LU low', async () => {
    const temporaryPath = `${masterPath}${MASTER_NORMALIZATION_TEMP_SUFFIX}`;
    const runner = new FixtureCommandRunner([
      {
        bin: 'ffmpeg',
        argsPattern: ['-f', 'null'],
        response: { stderr: loudnormJson(-18.14, -3.17), exitCode: 0 },
      },
      {
        bin: 'ffmpeg',
        argsPattern: ['-filter_complex'],
        response: () => {
          writeFileSync(temporaryPath, 'normalized');
          return { stderr: '', exitCode: 0 };
        },
      },
    ]);

    const result = await normalizeMasterLoudness(masterPath, DEFAULT_VOICE_TARGET, runner);

    expect(result.applied).toBe(true);
    expect(result.measuredBefore.integratedLufs).toBe(-18.14);
    expect(runner.calls).toHaveLength(2);
    expect(runner.calls[1]?.args).toContain(masterPath);
    expect(runner.calls[1]?.args.at(-1)).toBe(temporaryPath);
    expect(runner.calls[1]?.args.join(' ')).toContain('measured_I=-18.14');
    expect(await readFile(masterPath, 'utf8')).toBe('normalized');
    expect(existsSync(temporaryPath)).toBe(false);
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
