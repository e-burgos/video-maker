import { CommandFailedError } from '../errors/command-failed-error';
import type { ReadTextFile } from '../fs/read-text-file';
import { nodeReadTextFile } from '../fs/read-text-file';
import type { CommandOptions, CommandRunner } from '../runner/command-runner';

export interface SynthesizeSpeechOptions {
  modelPath: string;
  tokensPath: string;
  dataDirPath: string;
  textPath: string;
  lengthScale?: number;
  ttsPath?: string;
  readTextFile?: ReadTextFile;
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
  const ttsPath = opts.ttsPath ?? 'sherpa-onnx-offline-tts';
  const readTextFile = opts.readTextFile ?? nodeReadTextFile;
  const lengthScaleArgs =
    opts.lengthScale === undefined || opts.lengthScale === 1
      ? []
      : ['--vits-length-scale', String(opts.lengthScale)];
  const narration = narrationToSingleLine(await readTextFile(opts.textPath));
  const args = [
    `--vits-model=${opts.modelPath}`,
    `--vits-tokens=${opts.tokensPath}`,
    `--vits-data-dir=${opts.dataDirPath}`,
    ...lengthScaleArgs,
    `--output-filename=${outPath}`,
    narration,
  ];

  const result = await runner.run(ttsPath, args, opts.runOptions);
  if (result.exitCode !== 0) {
    throw new CommandFailedError({
      command: ttsPath,
      args,
      exitCode: result.exitCode,
      stderr: result.stderr,
    });
  }

  return outPath;
}
