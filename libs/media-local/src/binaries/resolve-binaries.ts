import { delimiter, join } from 'node:path';

import { BinaryNotFoundError } from '../errors/binary-not-found-error';
import { nodeBinaryLookup } from '../fs/binary-lookup';
import type { BinaryLookup } from '../fs/binary-lookup';

export type BinaryName = 'ffmpeg' | 'ffprobe' | 'whisperCli' | 'whisperModel';

export const BINARY_ENV_VARS: Readonly<Record<BinaryName, string>> = {
  ffmpeg: 'FFMPEG_PATH',
  ffprobe: 'FFPROBE_PATH',
  whisperCli: 'WHISPER_CPP_PATH',
  whisperModel: 'WHISPER_MODEL_PATH',
};

export const BINARY_COMMAND_NAMES: Readonly<Record<BinaryName, string>> = {
  ffmpeg: 'ffmpeg',
  ffprobe: 'ffprobe',
  whisperCli: 'whisper-cli',
  whisperModel: 'ggml-model',
};

const BINARY_DISPLAY_NAMES: Readonly<Record<BinaryName, string>> = {
  ffmpeg: 'ffmpeg',
  ffprobe: 'ffprobe',
  whisperCli: 'whisper-cli',
  whisperModel: 'whisper-model',
};

export interface ResolveBinariesOptions {
  lookup?: BinaryLookup;
}

export interface ResolvedBinaries {
  ffmpeg: string;
  ffprobe: string;
  whisperCli: string;
  whisperModel: string;
}

function pathDirectories(env: NodeJS.ProcessEnv): string[] {
  return (env.PATH ?? '').split(delimiter).filter((dir) => dir !== '');
}

async function isValidCandidate(name: BinaryName, candidate: string, lookup: BinaryLookup): Promise<boolean> {
  return name === 'whisperModel' ? lookup.isReadableFile(candidate) : lookup.isExecutableFile(candidate);
}

export async function resolveBinary(
  name: BinaryName,
  env: NodeJS.ProcessEnv,
  opts?: ResolveBinariesOptions,
): Promise<string> {
  const lookup = opts?.lookup ?? nodeBinaryLookup;
  const envVar = BINARY_ENV_VARS[name];
  const binary = BINARY_DISPLAY_NAMES[name];
  const candidate = env[envVar];

  if (candidate !== undefined && candidate !== '') {
    if (await isValidCandidate(name, candidate, lookup)) {
      return candidate;
    }
    throw new BinaryNotFoundError({ binary, envVar, searchedPaths: [candidate] });
  }

  if (name === 'whisperModel') {
    throw new BinaryNotFoundError({ binary, envVar, searchedPaths: [] });
  }

  const commandName = BINARY_COMMAND_NAMES[name];
  const directories = pathDirectories(env);
  for (const dir of directories) {
    const candidatePath = join(dir, commandName);
    if (await lookup.isExecutableFile(candidatePath)) {
      return candidatePath;
    }
  }

  throw new BinaryNotFoundError({
    binary,
    envVar,
    searchedPaths: directories.map((dir) => join(dir, commandName)),
  });
}

export async function resolveBinaries(
  env: NodeJS.ProcessEnv,
  opts?: ResolveBinariesOptions,
): Promise<ResolvedBinaries> {
  const ffprobe = await resolveBinary('ffprobe', env, opts);
  const ffmpeg = await resolveBinary('ffmpeg', env, opts);
  const whisperCli = await resolveBinary('whisperCli', env, opts);
  const whisperModel = await resolveBinary('whisperModel', env, opts);
  return { ffmpeg, ffprobe, whisperCli, whisperModel };
}
