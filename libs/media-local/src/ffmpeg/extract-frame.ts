import { CommandFailedError } from '../errors/command-failed-error';
import type { CommandOptions, CommandRunner } from '../runner/command-runner';

export const DEFAULT_EXTRACT_FRAME_MAX_LONG_SIDE_PX = 768;
export const DEFAULT_EXTRACT_FRAME_QUALITY = 3;

export interface ExtractFrameOptions {
  maxLongSidePx?: number;
  quality?: number;
  ffmpegPath?: string;
  runOptions?: CommandOptions;
}

export function extractFrameScaleFilter(maxLongSidePx: number): string {
  return `scale=if(gt(iw\\,ih)\\,${maxLongSidePx}\\,-2):if(gt(iw\\,ih)\\,-2\\,${maxLongSidePx})`;
}

export async function extractFrame(
  path: string,
  atSeconds: number,
  out: string,
  runner: CommandRunner,
  opts?: ExtractFrameOptions,
): Promise<string> {
  const maxLongSidePx = opts?.maxLongSidePx ?? DEFAULT_EXTRACT_FRAME_MAX_LONG_SIDE_PX;
  const quality = opts?.quality ?? DEFAULT_EXTRACT_FRAME_QUALITY;
  const ffmpegPath = opts?.ffmpegPath ?? 'ffmpeg';
  const args = [
    '-hide_banner',
    '-nostats',
    '-y',
    '-ss',
    String(atSeconds),
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
