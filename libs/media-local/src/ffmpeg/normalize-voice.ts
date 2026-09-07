import type { VoiceTarget } from '@video-maker/timeline-core';

import { CommandFailedError } from '../errors/command-failed-error';
import type { CommandOptions, CommandRunner } from '../runner/command-runner';
import { buildLoudnormFilter } from './build-loudnorm-filter';
import { measureLoudness } from './measure-loudness';
import type { LoudnessMeasurement } from './parse-loudnorm-json';

const DEFAULT_SAMPLE_RATE = 48000;

export { buildLoudnormFilter };

export interface NormalizeVoiceResult {
  outputPath: string;
  measured: LoudnessMeasurement;
  filter: string;
}

export interface NormalizeVoiceOptions {
  sampleRate?: number;
  ffmpegPath?: string;
  runOptions?: CommandOptions;
}

export async function normalizeVoice(
  path: string,
  out: string,
  target: VoiceTarget,
  runner: CommandRunner,
  opts?: NormalizeVoiceOptions,
): Promise<NormalizeVoiceResult> {
  const ffmpegPath = opts?.ffmpegPath ?? 'ffmpeg';
  const sampleRate = opts?.sampleRate ?? DEFAULT_SAMPLE_RATE;

  const measured = await measureLoudness(path, runner, {
    target,
    ffmpegPath,
    ...(opts?.runOptions !== undefined ? { runOptions: opts.runOptions } : {}),
  });
  const filter = buildLoudnormFilter(target, measured);

  const args = [
    '-hide_banner',
    '-nostats',
    '-y',
    '-i',
    path,
    '-af',
    filter,
    '-ar',
    String(sampleRate),
    out,
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

  return { outputPath: out, measured, filter };
}
