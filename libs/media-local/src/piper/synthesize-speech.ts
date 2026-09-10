import { CommandFailedError } from '../errors/command-failed-error';
import type { CommandOptions, CommandRunner } from '../runner/command-runner';

export interface SynthesizeSpeechOptions {
  modelPath: string;
  textPath: string;
  piperPath?: string;
  runOptions?: CommandOptions;
}

export function narrationToSingleLine(narration: string): string {
  return narration.replace(/\s+/gu, ' ').trim();
}

export async function synthesizeSpeech(
  outPath: string,
  opts: SynthesizeSpeechOptions,
  runner: CommandRunner,
): Promise<string> {
  const piperPath = opts.piperPath ?? 'piper';
  const args = ['-m', opts.modelPath, '-i', opts.textPath, '-f', outPath];

  const result = await runner.run(piperPath, args, opts.runOptions);
  if (result.exitCode !== 0) {
    throw new CommandFailedError({
      command: piperPath,
      args,
      exitCode: result.exitCode,
      stderr: result.stderr,
    });
  }

  return outPath;
}
