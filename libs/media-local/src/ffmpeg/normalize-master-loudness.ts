import { rename, rm } from 'node:fs/promises';

import type { VoiceTarget } from '@video-maker/timeline-core';

import { CommandFailedError } from '../errors/command-failed-error';
import { AUDIO_MIX_SAMPLE_RATE } from '../mix/audio-mix-format';
import { audioMixFfmpegArgs } from '../mix/audio-mix-ffmpeg-args';
import type { FilterGraph } from '../mix/filter-graph';
import type { CommandOptions, CommandRunner } from '../runner/command-runner';
import { buildLoudnormFilter } from './build-loudnorm-filter';
import { FIRST_AUDIO_STREAM, measureLoudness } from './measure-loudness';
import type { LoudnessMeasurement } from './parse-loudnorm-json';

export const MASTER_NORMALIZATION_TOLERANCE_LU = 0.5;
export const MASTER_NORMALIZATION_TEMP_SUFFIX = '.normalized.wav';
export const ENCODER_TRUE_PEAK_HEADROOM_DB = 0.5;

export function masterLoudnessTarget(target: VoiceTarget): VoiceTarget {
  return { ...target, truePeakDbtp: target.truePeakDbtp - ENCODER_TRUE_PEAK_HEADROOM_DB };
}

export interface NormalizeMasterLoudnessOptions {
  ffmpegPath?: string;
  runOptions?: CommandOptions;
}

export interface NormalizeMasterLoudnessResult {
  readonly applied: boolean;
  readonly measuredBefore: LoudnessMeasurement;
  readonly args: readonly string[] | null;
}

export function needsMasterNormalization(measured: LoudnessMeasurement, target: VoiceTarget): boolean {
  return (
    Math.abs(measured.integratedLufs - target.integratedLufs) > MASTER_NORMALIZATION_TOLERANCE_LU ||
    measured.truePeakDbtp > target.truePeakDbtp
  );
}

export function buildMasterNormalizationGraph(
  inputPath: string,
  target: VoiceTarget,
  measured: LoudnessMeasurement,
): FilterGraph {
  return {
    inputs: [inputPath],
    chains: [
      {
        inputLabels: ['0:a'],
        filters: [buildLoudnormFilter(target, measured), `aresample=${AUDIO_MIX_SAMPLE_RATE}`],
        outputLabels: ['master'],
      },
    ],
    outputLabel: 'master',
  };
}

export async function normalizeMasterLoudness(
  masterPath: string,
  deliveryTarget: VoiceTarget,
  runner: CommandRunner,
  opts?: NormalizeMasterLoudnessOptions,
): Promise<NormalizeMasterLoudnessResult> {
  const ffmpegPath = opts?.ffmpegPath ?? 'ffmpeg';
  const target = masterLoudnessTarget(deliveryTarget);
  const measuredBefore = await measureLoudness(masterPath, runner, {
    target,
    ffmpegPath,
    audioStreamSpecifier: FIRST_AUDIO_STREAM,
    ...(opts?.runOptions !== undefined ? { runOptions: opts.runOptions } : {}),
  });

  if (!needsMasterNormalization(measuredBefore, target)) {
    return { applied: false, measuredBefore, args: null };
  }

  const temporaryPath = `${masterPath}${MASTER_NORMALIZATION_TEMP_SUFFIX}`;
  const args = audioMixFfmpegArgs(buildMasterNormalizationGraph(masterPath, target, measuredBefore), temporaryPath);
  const result = await runner.run(ffmpegPath, args, opts?.runOptions);

  if (result.exitCode !== 0) {
    await rm(temporaryPath, { force: true });
    throw new CommandFailedError({ command: ffmpegPath, args, exitCode: result.exitCode, stderr: result.stderr });
  }

  await rename(temporaryPath, masterPath);

  return { applied: true, measuredBefore, args };
}
