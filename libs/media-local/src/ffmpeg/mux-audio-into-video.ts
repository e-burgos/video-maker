import { CommandFailedError } from '../errors/command-failed-error';
import { MissingMediaStreamError } from '../errors/missing-media-stream-error';
import { probeMedia } from '../ffprobe/probe-media';
import type { CommandOptions, CommandRunner } from '../runner/command-runner';

export const MUX_AUDIO_CODEC = 'aac';
export const MUX_AUDIO_BITRATE = '192k';

export interface MuxAudioIntoVideoOptions {
  ffmpegPath?: string;
  ffprobePath?: string;
  runOptions?: CommandOptions;
}

export interface MuxAudioIntoVideoResult {
  readonly outputPath: string;
  readonly args: readonly string[];
}

async function assertVideoStreamPresent(
  videoPath: string,
  runner: CommandRunner,
  ffprobePath: string,
  runOptions: CommandOptions | undefined,
): Promise<void> {
  const asset = await probeMedia(videoPath, runner, {
    ffprobePath,
    ...(runOptions !== undefined ? { runOptions } : {}),
  });

  if (asset.kind !== 'video') {
    throw new MissingMediaStreamError({ path: videoPath, stream: 'video' });
  }
}

export async function muxAudioIntoVideo(
  videoPath: string,
  audioPath: string,
  out: string,
  runner: CommandRunner,
  opts?: MuxAudioIntoVideoOptions,
): Promise<MuxAudioIntoVideoResult> {
  const ffmpegPath = opts?.ffmpegPath ?? 'ffmpeg';
  const ffprobePath = opts?.ffprobePath ?? 'ffprobe';

  await assertVideoStreamPresent(videoPath, runner, ffprobePath, opts?.runOptions);

  const args = [
    '-hide_banner',
    '-nostats',
    '-y',
    '-i',
    videoPath,
    '-i',
    audioPath,
    '-map',
    '0:v:0',
    '-map',
    '1:a:0',
    '-c:v',
    'copy',
    '-c:a',
    MUX_AUDIO_CODEC,
    '-b:a',
    MUX_AUDIO_BITRATE,
    '-shortest',
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

  return { outputPath: out, args };
}
