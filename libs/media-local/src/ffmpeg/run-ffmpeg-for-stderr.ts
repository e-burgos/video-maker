import { CommandFailedError } from '../errors/command-failed-error';
import type { CommandOptions, CommandRunner } from '../runner/command-runner';

export async function runFfmpegForStderr(
  ffmpegPath: string,
  args: string[],
  runner: CommandRunner,
  runOptions?: CommandOptions,
): Promise<string> {
  const result = await runner.run(ffmpegPath, args, runOptions);
  if (result.exitCode !== 0) {
    throw new CommandFailedError({ command: ffmpegPath, args, exitCode: result.exitCode, stderr: result.stderr });
  }
  return result.stderr;
}
