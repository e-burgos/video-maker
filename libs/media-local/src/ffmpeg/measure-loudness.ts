import type { VoiceTarget } from '@video-maker/timeline-core';

import { CommandFailedError } from '../errors/command-failed-error';
import type { CommandOptions, CommandRunner } from '../runner/command-runner';
import { buildLoudnormFilter } from './build-loudnorm-filter';
import type { LoudnessMeasurement } from './parse-loudnorm-json';
import { parseLoudnormJson } from './parse-loudnorm-json';

export const DEFAULT_VOICE_TARGET: VoiceTarget = {
  integratedLufs: -14,
  truePeakDbtp: -1,
  loudnessRange: 11,
};

export interface MeasureLoudnessOptions {
  target?: VoiceTarget;
  ffmpegPath?: string;
  runOptions?: CommandOptions;
}

export async function measureLoudness(
  path: string,
  runner: CommandRunner,
  opts?: MeasureLoudnessOptions,
): Promise<LoudnessMeasurement> {
  const target = opts?.target ?? DEFAULT_VOICE_TARGET;
  const ffmpegPath = opts?.ffmpegPath ?? 'ffmpeg';
  const args = [
    '-hide_banner',
    '-nostats',
    '-i',
    path,
    '-af',
    buildLoudnormFilter(target),
    '-f',
    'null',
    '-',
  ];

  const result = await runner.run(ffmpegPath, args, opts?.runOptions);
  if (result.exitCode !== 0) {
    throw new CommandFailedError({
      command: ffmpegPath,
      args,
      exitCode: result.exitCode,
      stderr: result.stderr,
    });
  }

  return parseLoudnormJson(result.stderr);
}
