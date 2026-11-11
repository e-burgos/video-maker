import { rename, rm } from 'node:fs/promises';

import type { VoiceTarget } from '@video-maker/timeline-core';

import { CommandFailedError } from '../errors/command-failed-error';
import { AUDIO_MIX_SAMPLE_RATE } from '../mix/audio-mix-format';
import { audioMixFfmpegArgs } from '../mix/audio-mix-ffmpeg-args';
import { formatFilterNumber } from '../mix/format-filter-number';
import type { FilterGraph } from '../mix/filter-graph';
import type { CommandOptions, CommandRunner } from '../runner/command-runner';
import { FIRST_AUDIO_STREAM, measureLoudness } from './measure-loudness';
import { MUX_AUDIO_BITRATE, MUX_AUDIO_CODEC } from './mux-audio-into-video';
import type { LoudnessMeasurement } from './parse-loudnorm-json';
import { encoderOvershootDb, targetBelowOvershoot } from './true-peak-guard';

export const MASTER_NORMALIZATION_TOLERANCE_LU = 0.5;
export const MASTER_NORMALIZATION_TEMP_SUFFIX = '.normalized.wav';
export const ENCODER_TRUE_PEAK_HEADROOM_DB = 0.5;
export const AAC_PROBE_SUFFIX = '.aac-probe.m4a';
export const LIMITER_OVERSAMPLE_RATE = 192_000;
export const LIMITER_ATTACK_MS = 1;
export const LIMITER_RELEASE_MS = 60;

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
  readonly truePeakRetried: boolean;
}

export function needsMasterNormalization(measured: LoudnessMeasurement, target: VoiceTarget): boolean {
  return (
    Math.abs(measured.integratedLufs - target.integratedLufs) > MASTER_NORMALIZATION_TOLERANCE_LU ||
    measured.truePeakDbtp > target.truePeakDbtp
  );
}

export function masterGainDb(target: VoiceTarget, measured: LoudnessMeasurement): number {
  return Math.round((target.integratedLufs - measured.integratedLufs) * 100) / 100;
}

function limiterCeiling(target: VoiceTarget): number {
  return Math.round(10 ** (target.truePeakDbtp / 20) * 10_000) / 10_000;
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
        filters: [
          `volume=${formatFilterNumber(masterGainDb(target, measured))}dB`,
          `aresample=${LIMITER_OVERSAMPLE_RATE}`,
          `alimiter=limit=${formatFilterNumber(limiterCeiling(target))}:attack=${LIMITER_ATTACK_MS}:release=${LIMITER_RELEASE_MS}:level=false:latency=true`,
          `aresample=${AUDIO_MIX_SAMPLE_RATE}`,
        ],
        outputLabels: ['master'],
      },
    ],
    outputLabel: 'master',
  };
}

async function writeNormalizedMaster(
  masterPath: string,
  temporaryPath: string,
  target: VoiceTarget,
  measured: LoudnessMeasurement,
  runner: CommandRunner,
  ffmpegPath: string,
  opts: NormalizeMasterLoudnessOptions | undefined,
): Promise<readonly string[]> {
  const args = audioMixFfmpegArgs(buildMasterNormalizationGraph(masterPath, target, measured), temporaryPath);
  const result = await runner.run(ffmpegPath, args, opts?.runOptions);
  if (result.exitCode !== 0) {
    await rm(temporaryPath, { force: true });
    throw new CommandFailedError({ command: ffmpegPath, args, exitCode: result.exitCode, stderr: result.stderr });
  }
  return args;
}

export function aacProbeArgs(inputPath: string, outputPath: string): string[] {
  return ['-hide_banner', '-nostats', '-y', '-i', inputPath, '-c:a', MUX_AUDIO_CODEC, '-b:a', MUX_AUDIO_BITRATE, outputPath];
}

async function measureTruePeakAfterAac(
  wavPath: string,
  target: VoiceTarget,
  runner: CommandRunner,
  ffmpegPath: string,
  opts: NormalizeMasterLoudnessOptions | undefined,
): Promise<number> {
  const probePath = `${wavPath}${AAC_PROBE_SUFFIX}`;
  try {
    const args = aacProbeArgs(wavPath, probePath);
    const result = await runner.run(ffmpegPath, args, opts?.runOptions);
    if (result.exitCode !== 0) {
      throw new CommandFailedError({ command: ffmpegPath, args, exitCode: result.exitCode, stderr: result.stderr });
    }
    const measured = await measureLoudness(probePath, runner, {
      target,
      ffmpegPath,
      audioStreamSpecifier: FIRST_AUDIO_STREAM,
      ...(opts?.runOptions !== undefined ? { runOptions: opts.runOptions } : {}),
    });
    return measured.truePeakDbtp;
  } finally {
    await rm(probePath, { force: true });
  }
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

  const temporaryPath = `${masterPath}${MASTER_NORMALIZATION_TEMP_SUFFIX}`;
  const normalized = needsMasterNormalization(measuredBefore, target);
  let args = normalized ? await writeNormalizedMaster(masterPath, temporaryPath, target, measuredBefore, runner, ffmpegPath, opts) : null;

  const plannedPeak = normalized ? target.truePeakDbtp : measuredBefore.truePeakDbtp;
  const encodedPeak = await measureTruePeakAfterAac(normalized ? temporaryPath : masterPath, target, runner, ffmpegPath, opts).catch(async (cause: unknown) => {
    await rm(temporaryPath, { force: true });
    throw cause;
  });
  const overshootDb = encoderOvershootDb(encodedPeak, plannedPeak, deliveryTarget.truePeakDbtp);
  if (overshootDb > 0) {
    args = await writeNormalizedMaster(masterPath, temporaryPath, targetBelowOvershoot(target, overshootDb), measuredBefore, runner, ffmpegPath, opts);
  }

  if (args === null) {
    return { applied: false, measuredBefore, args: null, truePeakRetried: false };
  }

  await rename(temporaryPath, masterPath);

  return { applied: true, measuredBefore, args, truePeakRetried: overshootDb > 0 };
}
