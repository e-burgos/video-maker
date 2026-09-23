import { delimiter, join } from 'node:path';

import { BinaryNotFoundError } from '../errors/binary-not-found-error';
import { nodeBinaryLookup } from '../fs/binary-lookup';
import type { BinaryLookup } from '../fs/binary-lookup';

export type BinaryName = 'ffmpeg' | 'ffprobe' | 'whisperCli' | 'whisperModel' | 'ttsCli' | 'ttsVoicesDir';

export const BUNDLED_BIN_DIR_ENV_VAR = 'VIDEO_MAKER_BIN_DIR';
export const APP_DATA_MODELS_DIR_ENV_VAR = 'VIDEO_MAKER_MODELS_DIR';

type BinaryKind = 'executable' | 'file' | 'directory';

const BINARY_KINDS: Readonly<Record<BinaryName, BinaryKind>> = {
  ffmpeg: 'executable',
  ffprobe: 'executable',
  whisperCli: 'executable',
  whisperModel: 'file',
  ttsCli: 'executable',
  ttsVoicesDir: 'directory',
};

export const BINARY_ENV_VARS: Readonly<Record<BinaryName, string>> = {
  ffmpeg: 'FFMPEG_PATH',
  ffprobe: 'FFPROBE_PATH',
  whisperCli: 'WHISPER_CPP_PATH',
  whisperModel: 'WHISPER_MODEL_PATH',
  ttsCli: 'TTS_CLI_PATH',
  ttsVoicesDir: 'TTS_VOICES_DIR',
};

export const BINARY_COMMAND_NAMES: Readonly<Record<BinaryName, string>> = {
  ffmpeg: 'ffmpeg',
  ffprobe: 'ffprobe',
  whisperCli: 'whisper-cli',
  whisperModel: 'ggml-model',
  ttsCli: 'sherpa-onnx-offline-tts',
  ttsVoicesDir: 'voices',
};

const BINARY_DISPLAY_NAMES: Readonly<Record<BinaryName, string>> = {
  ffmpeg: 'ffmpeg',
  ffprobe: 'ffprobe',
  whisperCli: 'whisper-cli',
  whisperModel: 'whisper-model',
  ttsCli: 'sherpa-onnx-offline-tts',
  ttsVoicesDir: 'tts-voices',
};

const APP_DATA_RELATIVE_PATHS: Readonly<Partial<Record<BinaryName, string>>> = {
  whisperModel: 'whisper-model.bin',
  ttsVoicesDir: 'voices',
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

export interface ResolvedVoiceBinaries extends ResolvedBinaries {
  ttsCli: string;
  ttsVoicesDir: string;
}

function pathDirectories(env: NodeJS.ProcessEnv): string[] {
  return (env.PATH ?? '').split(delimiter).filter((dir) => dir !== '');
}

function readNonEmpty(env: NodeJS.ProcessEnv, key: string): string | null {
  const value = env[key];
  return value === undefined || value === '' ? null : value;
}

async function isValidCandidate(kind: BinaryKind, candidate: string, lookup: BinaryLookup): Promise<boolean> {
  if (kind === 'executable') {
    return lookup.isExecutableFile(candidate);
  }
  return kind === 'directory' ? lookup.isReadableDirectory(candidate) : lookup.isReadableFile(candidate);
}

async function resolveFromAppDataDir(
  name: BinaryName,
  env: NodeJS.ProcessEnv,
  lookup: BinaryLookup,
): Promise<string | null> {
  const modelsDir = readNonEmpty(env, APP_DATA_MODELS_DIR_ENV_VAR);
  const relativePath = APP_DATA_RELATIVE_PATHS[name];
  if (modelsDir === null || relativePath === undefined) {
    return null;
  }

  const candidate = join(modelsDir, relativePath);
  return (await isValidCandidate(BINARY_KINDS[name], candidate, lookup)) ? candidate : null;
}

async function resolveExecutable(
  name: BinaryName,
  env: NodeJS.ProcessEnv,
  lookup: BinaryLookup,
): Promise<string> {
  const envVar = BINARY_ENV_VARS[name];
  const binary = BINARY_DISPLAY_NAMES[name];
  const commandName = BINARY_COMMAND_NAMES[name];
  const binDir = readNonEmpty(env, BUNDLED_BIN_DIR_ENV_VAR);
  const searched: string[] = [];

  if (binDir !== null) {
    const bundledPath = join(binDir, commandName);
    searched.push(bundledPath);
    if (await lookup.isExecutableFile(bundledPath)) {
      return bundledPath;
    }
  }

  const directories = pathDirectories(env);
  for (const dir of directories) {
    const candidatePath = join(dir, commandName);
    searched.push(candidatePath);
    if (await lookup.isExecutableFile(candidatePath)) {
      return candidatePath;
    }
  }

  throw new BinaryNotFoundError({ binary, envVar, searchedPaths: searched });
}

export async function resolveBinary(
  name: BinaryName,
  env: NodeJS.ProcessEnv,
  opts?: ResolveBinariesOptions,
): Promise<string> {
  const lookup = opts?.lookup ?? nodeBinaryLookup;
  const envVar = BINARY_ENV_VARS[name];
  const binary = BINARY_DISPLAY_NAMES[name];
  const kind = BINARY_KINDS[name];
  const candidate = env[envVar];

  if (candidate !== undefined && candidate !== '') {
    if (await isValidCandidate(kind, candidate, lookup)) {
      return candidate;
    }
    throw new BinaryNotFoundError({ binary, envVar, searchedPaths: [candidate] });
  }

  if (kind !== 'executable') {
    const fromAppData = await resolveFromAppDataDir(name, env, lookup);
    if (fromAppData !== null) {
      return fromAppData;
    }

    const modelsDir = readNonEmpty(env, APP_DATA_MODELS_DIR_ENV_VAR);
    const relativePath = APP_DATA_RELATIVE_PATHS[name];
    const searched = modelsDir === null || relativePath === undefined ? [] : [join(modelsDir, relativePath)];
    throw new BinaryNotFoundError({ binary, envVar, searchedPaths: searched });
  }

  return resolveExecutable(name, env, lookup);
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

export async function resolveVoiceBinaries(
  env: NodeJS.ProcessEnv,
  opts?: ResolveBinariesOptions,
): Promise<ResolvedVoiceBinaries> {
  const base = await resolveBinaries(env, opts);
  const ttsCli = await resolveBinary('ttsCli', env, opts);
  const ttsVoicesDir = await resolveBinary('ttsVoicesDir', env, opts);
  return { ...base, ttsCli, ttsVoicesDir };
}
