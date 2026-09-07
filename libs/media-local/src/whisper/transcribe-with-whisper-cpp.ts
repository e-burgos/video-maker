import { basename } from 'node:path';

import type { AssetId, Transcription } from '@video-maker/timeline-core';

import { CommandFailedError } from '../errors/command-failed-error';
import { UnparseableOutputError } from '../errors/unparseable-output-error';
import type { ReadTextFile } from '../fs/read-text-file';
import { nodeReadTextFile } from '../fs/read-text-file';
import type { CommandOptions, CommandRunner } from '../runner/command-runner';
import { parseWhisperCppJson } from './parse-whisper-cpp-json';
import type { ParseTranscriptionOptions } from './parse-whisper-cpp-json';

export const DEFAULT_WHISPER_LANGUAGE = 'auto';
const OUTPUT_SAMPLE_CHARS = 512;

export interface TranscribeWithWhisperCppOptions {
  modelPath: string;
  outBase: string;
  assetId: AssetId;
  language?: string;
  whisperPath?: string;
  readTextFile?: ReadTextFile;
  runOptions?: CommandOptions;
}

export async function transcribeWithWhisperCpp(
  wavPath: string,
  opts: TranscribeWithWhisperCppOptions,
  runner: CommandRunner,
): Promise<Transcription> {
  const whisperPath = opts.whisperPath ?? 'whisper-cli';
  const language = opts.language ?? DEFAULT_WHISPER_LANGUAGE;
  const readTextFile = opts.readTextFile ?? nodeReadTextFile;
  const args = [
    '-m',
    opts.modelPath,
    '-f',
    wavPath,
    '-oj',
    '-ml',
    '1',
    '-l',
    language,
    '-of',
    opts.outBase,
  ];

  const result = await runner.run(whisperPath, args, opts.runOptions);
  if (result.exitCode !== 0) {
    throw new CommandFailedError({
      command: whisperPath,
      args,
      exitCode: result.exitCode,
      stderr: result.stderr,
    });
  }

  const outputPath = `${opts.outBase}.json`;
  let raw: string;
  try {
    raw = await readTextFile(outputPath);
  } catch (cause) {
    throw new UnparseableOutputError({
      command: 'whisper.cpp',
      reason: `No se pudo leer el archivo de salida esperado "${outputPath}".`,
      sample: result.stdout.slice(-OUTPUT_SAMPLE_CHARS),
      cause,
    });
  }

  const parseOptions: ParseTranscriptionOptions = {
    ...(language !== DEFAULT_WHISPER_LANGUAGE ? { language } : {}),
    model: basename(opts.modelPath),
  };

  return parseWhisperCppJson(raw, opts.assetId, parseOptions);
}
