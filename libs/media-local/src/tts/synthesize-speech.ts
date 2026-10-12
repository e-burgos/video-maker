import { CommandFailedError } from '../errors/command-failed-error';
import type { ReadTextFile } from '../fs/read-text-file';
import { nodeReadTextFile } from '../fs/read-text-file';
import { rm } from 'node:fs/promises';

import { appendTrailingSilence } from '../ffmpeg/append-trailing-silence';
import type { CommandOptions, CommandRunner } from '../runner/command-runner';

export interface SynthesizeSpeechOptions {
  modelPath: string;
  tokensPath: string;
  dataDirPath: string;
  textPath: string;
  lengthScale?: number;
  noiseScale?: number;
  noiseScaleW?: number;
  trailingPauseMs?: number;
  ffmpegPath?: string;
  removeFile?: (path: string) => Promise<void>;
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
      : [`--vits-length-scale=${opts.lengthScale}`];
  const noiseArgs = [
    ...(opts.noiseScale === undefined ? [] : [`--vits-noise-scale=${opts.noiseScale}`]),
    ...(opts.noiseScaleW === undefined ? [] : [`--vits-noise-scale-w=${opts.noiseScaleW}`]),
  ];
  const trailingPauseMs = opts.trailingPauseMs ?? 0;
  const speechPath = trailingPauseMs > 0 ? `${outPath}.speech.wav` : outPath;
  const narration = narrationToSingleLine(await readTextFile(opts.textPath));
  const args = [
    `--vits-model=${opts.modelPath}`,
    `--vits-tokens=${opts.tokensPath}`,
    `--vits-data-dir=${opts.dataDirPath}`,
    ...lengthScaleArgs,
    ...noiseArgs,
    `--output-filename=${speechPath}`,
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

  if (trailingPauseMs > 0) {
    await appendTrailingSilence(
      speechPath,
      outPath,
      {
        silenceMs: trailingPauseMs,
        ...(opts.ffmpegPath === undefined ? {} : { ffmpegPath: opts.ffmpegPath }),
        ...(opts.runOptions === undefined ? {} : { runOptions: opts.runOptions }),
      },
      runner,
    );
    await (opts.removeFile ?? removeIfPresent)(speechPath);
  }

  return outPath;
}

function removeIfPresent(path: string): Promise<void> {
  return rm(path, { force: true });
}
