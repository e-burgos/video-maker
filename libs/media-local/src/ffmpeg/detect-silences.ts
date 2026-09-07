import type { Ms, SilenceRange } from '@video-maker/timeline-core';

import { CommandFailedError } from '../errors/command-failed-error';
import type { CommandOptions, CommandRunner } from '../runner/command-runner';
import { parseSilenceDetect } from './parse-silence-detect';

export const DEFAULT_SILENCE_NOISE_DB = -35;
export const DEFAULT_SILENCE_MIN_MS = 500;

export interface DetectSilencesWithFfmpegOptions {
  durationMs: Ms;
  noiseDb?: number;
  minMs?: Ms;
  ffmpegPath?: string;
  runOptions?: CommandOptions;
}

function buildSilenceDetectFilter(noiseDb: number, minMs: Ms): string {
  return `silencedetect=noise=${noiseDb}dB:d=${minMs / 1000}`;
}

export async function detectSilencesWithFfmpeg(
  path: string,
  opts: DetectSilencesWithFfmpegOptions,
  runner: CommandRunner,
): Promise<SilenceRange[]> {
  const noiseDb = opts.noiseDb ?? DEFAULT_SILENCE_NOISE_DB;
  const minMs = opts.minMs ?? DEFAULT_SILENCE_MIN_MS;
  const ffmpegPath = opts.ffmpegPath ?? 'ffmpeg';
  const args = [
    '-hide_banner',
    '-nostats',
    '-i',
    path,
    '-af',
    buildSilenceDetectFilter(noiseDb, minMs),
    '-f',
    'null',
    '-',
  ];

  const result = await runner.run(ffmpegPath, args, opts.runOptions);
  if (result.exitCode !== 0) {
    throw new CommandFailedError({
      command: ffmpegPath,
      args,
      exitCode: result.exitCode,
      stderr: result.stderr,
    });
  }

  return parseSilenceDetect(result.stderr, { durationMs: opts.durationMs });
}
