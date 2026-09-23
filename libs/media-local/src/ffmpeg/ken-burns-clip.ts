import { CommandFailedError } from '../errors/command-failed-error';
import type { CommandOptions, CommandRunner } from '../runner/command-runner';

export const DEFAULT_KEN_BURNS_FPS = 30;
export const DEFAULT_KEN_BURNS_ZOOM_STEP = 0.0015;
export const DEFAULT_KEN_BURNS_MAX_ZOOM = 1.25;
export const DEFAULT_KEN_BURNS_SCALE_WIDTH = 2160;
export const DEFAULT_KEN_BURNS_SCALE_HEIGHT = 3840;
export const DEFAULT_KEN_BURNS_OUTPUT_WIDTH = 1080;
export const DEFAULT_KEN_BURNS_OUTPUT_HEIGHT = 1920;

export interface BuildKenBurnsClipOptions {
  fps?: number;
  zoomStep?: number;
  maxZoom?: number;
  scaleWidth?: number;
  scaleHeight?: number;
  outputWidth?: number;
  outputHeight?: number;
  ffmpegPath?: string;
  runOptions?: CommandOptions;
}

export function kenBurnsFilter(opts: {
  scaleWidth: number;
  scaleHeight: number;
  zoomStep: number;
  maxZoom: number;
  frames: number;
  outputWidth: number;
  outputHeight: number;
  fps: number;
}): string {
  const scale = `scale=${opts.scaleWidth}:${opts.scaleHeight}:force_original_aspect_ratio=increase`;
  const crop = `crop=${opts.scaleWidth}:${opts.scaleHeight}`;
  const zoompan = `zoompan=z=min(zoom+${opts.zoomStep}\\,${opts.maxZoom}):d=${opts.frames}:s=${opts.outputWidth}x${opts.outputHeight}:fps=${opts.fps}`;
  return `${scale},${crop},${zoompan},format=yuv420p`;
}

export async function buildKenBurnsClip(
  photoPath: string,
  frames: number,
  out: string,
  runner: CommandRunner,
  opts?: BuildKenBurnsClipOptions,
): Promise<string> {
  const fps = opts?.fps ?? DEFAULT_KEN_BURNS_FPS;
  const zoomStep = opts?.zoomStep ?? DEFAULT_KEN_BURNS_ZOOM_STEP;
  const maxZoom = opts?.maxZoom ?? DEFAULT_KEN_BURNS_MAX_ZOOM;
  const scaleWidth = opts?.scaleWidth ?? DEFAULT_KEN_BURNS_SCALE_WIDTH;
  const scaleHeight = opts?.scaleHeight ?? DEFAULT_KEN_BURNS_SCALE_HEIGHT;
  const outputWidth = opts?.outputWidth ?? DEFAULT_KEN_BURNS_OUTPUT_WIDTH;
  const outputHeight = opts?.outputHeight ?? DEFAULT_KEN_BURNS_OUTPUT_HEIGHT;
  const ffmpegPath = opts?.ffmpegPath ?? 'ffmpeg';

  const args = [
    '-hide_banner',
    '-nostats',
    '-y',
    '-loop',
    '1',
    '-i',
    photoPath,
    '-vf',
    kenBurnsFilter({ scaleWidth, scaleHeight, zoomStep, maxZoom, frames, outputWidth, outputHeight, fps }),
    '-frames:v',
    String(frames),
    '-c:v',
    'libx264',
    '-r',
    String(fps),
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
