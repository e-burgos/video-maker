import type { VoiceTarget } from '@video-maker/timeline-core';

import type { CommandOptions, CommandRunner } from '../runner/command-runner';
import { FIRST_AUDIO_STREAM, measureLoudness } from './measure-loudness';
import type { LoudnessMeasurement } from './parse-loudnorm-json';

export const MIX_INTEGRATED_TOLERANCE_LU = 1;
export const MIX_TRUE_PEAK_TOLERANCE_DB = 0;

export interface MixLoudnessVerification {
  readonly measured: LoudnessMeasurement;
  readonly withinTolerance: boolean;
  readonly integratedDeltaLu: number;
  readonly truePeakDeltaDb: number;
}

export interface VerifyMixLoudnessOptions {
  ffmpegPath?: string;
  runOptions?: CommandOptions;
}

export async function verifyMixLoudness(
  path: string,
  target: VoiceTarget,
  runner: CommandRunner,
  opts?: VerifyMixLoudnessOptions,
): Promise<MixLoudnessVerification> {
  const measured = await measureLoudness(path, runner, {
    target,
    ffmpegPath: opts?.ffmpegPath ?? 'ffmpeg',
    audioStreamSpecifier: FIRST_AUDIO_STREAM,
    ...(opts?.runOptions !== undefined ? { runOptions: opts.runOptions } : {}),
  });

  const integratedDeltaLu = measured.integratedLufs - target.integratedLufs;
  const truePeakDeltaDb = measured.truePeakDbtp - target.truePeakDbtp;
  const withinTolerance =
    Math.abs(integratedDeltaLu) <= MIX_INTEGRATED_TOLERANCE_LU && truePeakDeltaDb <= MIX_TRUE_PEAK_TOLERANCE_DB;

  return { measured, withinTolerance, integratedDeltaLu, truePeakDeltaDb };
}
