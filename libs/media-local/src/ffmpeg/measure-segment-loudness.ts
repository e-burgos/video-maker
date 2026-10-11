import { UnparseableOutputError } from '../errors/unparseable-output-error';
import type { CommandOptions, CommandRunner } from '../runner/command-runner';
import { runFfmpegForStderr } from './run-ffmpeg-for-stderr';
import type { TimeSegment } from './time-segment';

const SUMMARY_MARKER = 'Summary:';
const INTEGRATED_PATTERN = /I:\s+(-?\d+(?:\.\d+)?|-inf)\s+LUFS/;
const SILENCE_FLOOR_LUFS = -70;

export interface MeasureSegmentLoudnessOptions {
  ffmpegPath?: string;
  runOptions?: CommandOptions;
}

export function segmentLoudnessArgs(path: string, segment: TimeSegment): string[] {
  return [
    '-hide_banner',
    '-nostats',
    '-ss',
    String(segment.startSec),
    '-t',
    String(segment.endSec - segment.startSec),
    '-i',
    path,
    '-vn',
    '-af',
    'ebur128',
    '-f',
    'null',
    '-',
  ];
}

export function parseEbur128IntegratedLufs(stderr: string): number | null {
  const summaryStart = stderr.lastIndexOf(SUMMARY_MARKER);
  if (summaryStart === -1) {
    throw new UnparseableOutputError({ command: 'ffmpeg ebur128', reason: 'missing Summary block', sample: stderr });
  }
  const match = INTEGRATED_PATTERN.exec(stderr.slice(summaryStart));
  if (match === null) {
    throw new UnparseableOutputError({ command: 'ffmpeg ebur128', reason: 'missing integrated loudness', sample: stderr });
  }
  const lufs = match[1] === '-inf' ? Number.NEGATIVE_INFINITY : Number(match[1]);
  return lufs <= SILENCE_FLOOR_LUFS ? null : lufs;
}

export async function measureSegmentLoudness(
  path: string,
  segments: readonly TimeSegment[],
  runner: CommandRunner,
  opts?: MeasureSegmentLoudnessOptions,
): Promise<Array<number | null>> {
  const ffmpegPath = opts?.ffmpegPath ?? 'ffmpeg';
  const measurements: Array<number | null> = [];
  for (const segment of segments) {
    const stderr = await runFfmpegForStderr(ffmpegPath, segmentLoudnessArgs(path, segment), runner, opts?.runOptions);
    measurements.push(parseEbur128IntegratedLufs(stderr));
  }
  return measurements;
}
