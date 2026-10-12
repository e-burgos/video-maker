import { CommandFailedError } from '../errors/command-failed-error';
import type { CommandOptions, CommandRunner } from '../runner/command-runner';

export interface AppendTrailingSilenceOptions {
  silenceMs: number;
  ffmpegPath?: string;
  runOptions?: CommandOptions;
}

export async function appendTrailingSilence(
  inputPath: string,
  outPath: string,
  opts: AppendTrailingSilenceOptions,
  runner: CommandRunner,
): Promise<string> {
  const ffmpegPath = opts.ffmpegPath ?? 'ffmpeg';
  const args = [
    '-hide_banner',
    '-nostats',
    '-y',
    '-i',
    inputPath,
    '-af',
    `apad=pad_dur=${opts.silenceMs / 1000}`,
    '-c:a',
    'pcm_s16le',
    outPath,
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

  return outPath;
}
