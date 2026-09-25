import { CommandFailedError } from '../errors/command-failed-error';
import type { CommandOptions, CommandRunner } from '../runner/command-runner';
import { extractFrameScaleFilter } from './extract-frame';

export const DEFAULT_RESIZE_IMAGE_MAX_LONG_SIDE_PX = 1280;
export const DEFAULT_RESIZE_IMAGE_QUALITY = 3;

export interface ResizeImageOptions {
  maxLongSidePx?: number;
  quality?: number;
  ffmpegPath?: string;
  runOptions?: CommandOptions;
}

export async function resizeImage(
  path: string,
  out: string,
  runner: CommandRunner,
  opts?: ResizeImageOptions,
): Promise<string> {
  const maxLongSidePx = opts?.maxLongSidePx ?? DEFAULT_RESIZE_IMAGE_MAX_LONG_SIDE_PX;
  const quality = opts?.quality ?? DEFAULT_RESIZE_IMAGE_QUALITY;
  const ffmpegPath = opts?.ffmpegPath ?? 'ffmpeg';
  // No -ss: an image2 input's near-zero reported duration makes ffmpeg seek past its only frame and write nothing.
  const args = [
    '-hide_banner',
    '-nostats',
    '-y',
    '-i',
    path,
    '-frames:v',
    '1',
    '-vf',
    extractFrameScaleFilter(maxLongSidePx),
    '-q:v',
    String(quality),
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

  return out;
}
