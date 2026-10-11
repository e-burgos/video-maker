import type { CommandOptions, CommandRunner } from '../runner/command-runner';
import { runFfmpegForStderr } from './run-ffmpeg-for-stderr';
import type { DetectedSegment } from './time-segment';
import { toDetectedSegment } from './time-segment';

const SILENCE_START_PATTERN = /silence_start:\s*(-?\d+(?:\.\d+)?)/;
const SILENCE_END_PATTERN = /silence_end:\s*(-?\d+(?:\.\d+)?)/;

export interface DetectSilencesOptions {
  minDurationSec: number;
  noiseDb: number;
  audioDurationSec?: number;
  ffmpegPath?: string;
  runOptions?: CommandOptions;
}

export function parseSilenceSegments(stderr: string, audioDurationSec?: number): DetectedSegment[] {
  const segments: DetectedSegment[] = [];
  let openStartSec: number | undefined;
  for (const line of stderr.split(/\r?\n/)) {
    const startMatch = SILENCE_START_PATTERN.exec(line);
    if (startMatch !== null) {
      openStartSec = Math.max(Number(startMatch[1]), 0);
      continue;
    }
    const endMatch = SILENCE_END_PATTERN.exec(line);
    if (endMatch !== null && openStartSec !== undefined) {
      segments.push(toDetectedSegment(openStartSec, Number(endMatch[1])));
      openStartSec = undefined;
    }
  }
  if (openStartSec !== undefined && audioDurationSec !== undefined && audioDurationSec > openStartSec) {
    segments.push(toDetectedSegment(openStartSec, audioDurationSec));
  }
  return segments;
}

export function silenceDetectArgs(path: string, opts: DetectSilencesOptions): string[] {
  return [
    '-hide_banner',
    '-nostats',
    '-i',
    path,
    '-vn',
    '-af',
    `silencedetect=noise=${opts.noiseDb}dB:d=${opts.minDurationSec}`,
    '-f',
    'null',
    '-',
  ];
}

export async function detectSilences(
  path: string,
  runner: CommandRunner,
  opts: DetectSilencesOptions,
): Promise<DetectedSegment[]> {
  const stderr = await runFfmpegForStderr(opts.ffmpegPath ?? 'ffmpeg', silenceDetectArgs(path, opts), runner, opts.runOptions);
  return parseSilenceSegments(stderr, opts.audioDurationSec);
}
