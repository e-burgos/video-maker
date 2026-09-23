import { CommandFailedError } from '../errors/command-failed-error';
import type { CommandOptions, CommandRunner } from '../runner/command-runner';

export interface ConcatVideoClipsOptions {
  ffmpegPath?: string;
  runOptions?: CommandOptions;
}

export async function concatVideoClips(
  listPath: string,
  out: string,
  runner: CommandRunner,
  opts?: ConcatVideoClipsOptions,
): Promise<string> {
  const ffmpegPath = opts?.ffmpegPath ?? 'ffmpeg';
  const args = [
    '-hide_banner',
    '-nostats',
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    listPath,
    '-c',
    'copy',
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
