import { rename, rm } from 'node:fs/promises';

import { CommandFailedError } from '../errors/command-failed-error';
import { AUDIO_MIX_SAMPLE_RATE } from '../mix/audio-mix-format';
import type { CommandOptions, CommandRunner } from '../runner/command-runner';
import { measureLoudness } from './measure-loudness';

export const AUDIO_LOUDNESS_TOLERANCE_LU = 0.5;
export const AUDIO_NORMALIZATION_TEMP_SUFFIX = '.leveled.wav';
const MEASUREMENT_TRUE_PEAK_DBTP = -1;
const MEASUREMENT_LOUDNESS_RANGE = 11;

export interface NormalizeAudioLoudnessOptions {
  ffmpegPath?: string;
  runOptions?: CommandOptions;
}

export interface NormalizeAudioLoudnessResult {
  readonly applied: boolean;
  readonly measuredLufs: number;
  readonly gainDb: number;
}

export function audioGainArgs(inputPath: string, outputPath: string, gainDb: number): string[] {
  return [
    '-hide_banner',
    '-nostats',
    '-y',
    '-i',
    inputPath,
    '-af',
    `volume=${gainDb.toFixed(2)}dB`,
    '-ar',
    String(AUDIO_MIX_SAMPLE_RATE),
    outputPath,
  ];
}

export async function normalizeAudioLoudness(
  audioPath: string,
  targetLufs: number,
  runner: CommandRunner,
  opts?: NormalizeAudioLoudnessOptions,
): Promise<NormalizeAudioLoudnessResult> {
  const ffmpegPath = opts?.ffmpegPath ?? 'ffmpeg';
  const measured = await measureLoudness(audioPath, runner, {
    target: { integratedLufs: targetLufs, truePeakDbtp: MEASUREMENT_TRUE_PEAK_DBTP, loudnessRange: MEASUREMENT_LOUDNESS_RANGE },
    ffmpegPath,
    ...(opts?.runOptions !== undefined ? { runOptions: opts.runOptions } : {}),
  });
  const gainDb = targetLufs - measured.integratedLufs;

  if (Math.abs(gainDb) <= AUDIO_LOUDNESS_TOLERANCE_LU) {
    return { applied: false, measuredLufs: measured.integratedLufs, gainDb: 0 };
  }

  const temporaryPath = `${audioPath}${AUDIO_NORMALIZATION_TEMP_SUFFIX}`;
  const args = audioGainArgs(audioPath, temporaryPath, gainDb);
  const result = await runner.run(ffmpegPath, args, opts?.runOptions);
  if (result.exitCode !== 0) {
    await rm(temporaryPath, { force: true });
    throw new CommandFailedError({ command: ffmpegPath, args, exitCode: result.exitCode, stderr: result.stderr });
  }
  await rename(temporaryPath, audioPath);

  return { applied: true, measuredLufs: measured.integratedLufs, gainDb };
}
