import type { CommandOptions, CommandRunner } from '../runner/command-runner';
import { runFfmpegForStderr } from './run-ffmpeg-for-stderr';
import type { DetectedSegment } from './time-segment';
import { toDetectedSegment } from './time-segment';

export const DEFAULT_BLACK_PIXEL_THRESHOLD = 0.1;
export const DEFAULT_FREEZE_NOISE_DB = -60;

const BLACK_PATTERN = /black_start:\s*(-?\d+(?:\.\d+)?)\s+black_end:\s*(-?\d+(?:\.\d+)?)/;
const FREEZE_START_PATTERN = /freeze_start:\s*(-?\d+(?:\.\d+)?)/;
const FREEZE_END_PATTERN = /freeze_end:\s*(-?\d+(?:\.\d+)?)/;

export interface DetectBlackSegmentsOptions {
  minDurationSec: number;
  pixelThreshold?: number;
  ffmpegPath?: string;
  runOptions?: CommandOptions;
}

export interface DetectFrozenSegmentsOptions {
  minDurationSec: number;
  noiseDb?: number;
  videoDurationSec?: number;
  ffmpegPath?: string;
  runOptions?: CommandOptions;
}

export function parseBlackDetect(stderr: string): DetectedSegment[] {
  const segments: DetectedSegment[] = [];
  for (const line of stderr.split(/\r?\n/)) {
    const match = BLACK_PATTERN.exec(line);
    if (match !== null) {
      segments.push(toDetectedSegment(Number(match[1]), Number(match[2])));
    }
  }
  return segments;
}

export function parseFreezeDetect(stderr: string, videoDurationSec?: number): DetectedSegment[] {
  const segments: DetectedSegment[] = [];
  let openStartSec: number | undefined;
  for (const line of stderr.split(/\r?\n/)) {
    const startMatch = FREEZE_START_PATTERN.exec(line);
    if (startMatch !== null) {
      openStartSec = Number(startMatch[1]);
      continue;
    }
    const endMatch = FREEZE_END_PATTERN.exec(line);
    if (endMatch !== null && openStartSec !== undefined) {
      segments.push(toDetectedSegment(openStartSec, Number(endMatch[1])));
      openStartSec = undefined;
    }
  }
  if (openStartSec !== undefined && videoDurationSec !== undefined && videoDurationSec > openStartSec) {
    segments.push(toDetectedSegment(openStartSec, videoDurationSec));
  }
  return segments;
}

function videoFilterArgs(path: string, filter: string): string[] {
  return ['-hide_banner', '-nostats', '-i', path, '-an', '-vf', filter, '-f', 'null', '-'];
}

export function blackDetectArgs(path: string, opts: DetectBlackSegmentsOptions): string[] {
  const pixelThreshold = opts.pixelThreshold ?? DEFAULT_BLACK_PIXEL_THRESHOLD;
  return videoFilterArgs(path, `blackdetect=d=${opts.minDurationSec}:pix_th=${pixelThreshold}`);
}

export function freezeDetectArgs(path: string, opts: DetectFrozenSegmentsOptions): string[] {
  const noiseDb = opts.noiseDb ?? DEFAULT_FREEZE_NOISE_DB;
  return videoFilterArgs(path, `freezedetect=n=${noiseDb}dB:d=${opts.minDurationSec}`);
}

export async function detectBlackSegments(
  path: string,
  runner: CommandRunner,
  opts: DetectBlackSegmentsOptions,
): Promise<DetectedSegment[]> {
  const stderr = await runFfmpegForStderr(opts.ffmpegPath ?? 'ffmpeg', blackDetectArgs(path, opts), runner, opts.runOptions);
  return parseBlackDetect(stderr);
}

export async function detectFrozenSegments(
  path: string,
  runner: CommandRunner,
  opts: DetectFrozenSegmentsOptions,
): Promise<DetectedSegment[]> {
  const stderr = await runFfmpegForStderr(opts.ffmpegPath ?? 'ffmpeg', freezeDetectArgs(path, opts), runner, opts.runOptions);
  return parseFreezeDetect(stderr, opts.videoDurationSec);
}
