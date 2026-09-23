import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createReadStream, createWriteStream } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, realpath, rename, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative } from 'node:path/posix';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStreamWeb } from 'node:stream/web';

import { nodeDirectoryReader, nodeFileStatReader } from '@video-maker/auto-montage';

import { createClaudeCliAiAgent } from '../ai/claude-cli-ai-agent';
import { readAiAgentConfig } from '../config/ai-agent-config';
import { readProducerConfig } from '../config/producer-config';
import { readServerConfig } from '../config/server-config';
import { readVoicePreviewConfig } from '../config/voice-preview-config';
import { createClaudeCodeProducerAgent } from '../producer/claude-code-producer-agent';
import type { SpawnedProducerProcess, SpawnProducerProcessInput } from '../producer/producer-agent';
import type { StoreConfig } from '../config/store-config';
import { ENGINE_MODULE_NAMES } from '../engine/engine-modules';
import type { EngineModuleStatus } from '../engine/engine-modules';
import { MEDIA_BINARY_NAMES } from '../engine/media-binaries';
import type { BinaryStatus, ResolvedMediaBinaries } from '../engine/media-binaries';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import type { ResolvedVoiceBinaries } from '@video-maker/media-local';

import type { ByteRange, ObjectStorage, WriteTemporaryInput, WriteTemporaryOutcome } from './object-storage';
import type { RenderApiDependencies, VoicePreviewCache } from './render-api-dependencies';

function createNodeVoicePreviewCache(directory: string): VoicePreviewCache {
  return {
    directory,
    ensureDirectory: async (path) => {
      await mkdir(path, { recursive: true });
    },
    stat: async (path) => {
      try {
        const stats = await stat(path);
        return stats.isFile()
          ? { sizeBytes: stats.size, modifiedAtMs: Math.trunc(stats.mtimeMs) }
          : null;
      } catch (error) {
        if (isEnoent(error)) {
          return null;
        }
        throw error;
      }
    },
    writeTextFile: async (path, contents) => {
      await writeFile(path, contents, 'utf8');
    },
    openReadStream: (path) => createReadStream(path),
  };
}

async function readVoiceModelConfig(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
}

function isEnoent(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as NodeJS.ErrnoException).code === 'ENOENT';
}

function assertInsideMediaRoot(store: StoreConfig, path: string): string {
  const relativePath = relative(store.mediaRoot, path);
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
    throw new PipelineStageError({
      code: 'ASSET_PATH_INVALID',
      stage: null,
      resource: relativePath,
      expected: 'a path inside the configured media root',
    });
  }
  return path;
}

async function statPath(path: string): ReturnType<ObjectStorage['stat']> {
  try {
    const info = await stat(path);
    return {
      kind: info.isDirectory() ? 'directory' : 'file',
      sizeBytes: info.size,
      modifiedAtMs: Math.trunc(info.mtimeMs),
    };
  } catch (error) {
    if (isEnoent(error)) {
      return null;
    }
    throw error;
  }
}

async function listDirectoryEntries(path: string): ReturnType<ObjectStorage['listDirectory']> {
  try {
    const entries = await readdir(path, { withFileTypes: true });
    return entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      isFile: entry.isFile(),
    }));
  } catch (error) {
    if (isEnoent(error)) {
      return null;
    }
    throw error;
  }
}

function emptyAsyncIterable(): AsyncIterable<Uint8Array> {
  return {
    [Symbol.asyncIterator]: () => ({
      next: () => Promise.resolve({ value: undefined, done: true as const }),
    }),
  };
}

async function* readFileRange(path: string, range?: ByteRange): AsyncGenerator<Uint8Array> {
  const options = range ? { start: range.start, end: range.end } : {};
  for await (const chunk of createReadStream(path, options)) {
    yield chunk as Uint8Array;
  }
}

async function unlinkTolerant(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch (error) {
    if (!isEnoent(error)) {
      throw error;
    }
  }
}

async function writeTemporaryStreaming(input: WriteTemporaryInput): Promise<WriteTemporaryOutcome> {
  const temporaryPath = join(input.directory, `upload-${randomUUID()}.part`);
  const outgoing = createWriteStream(temporaryPath);
  let bytesWritten = 0;

  try {
    for await (const chunk of input.source) {
      bytesWritten += chunk.length;
      if (bytesWritten > input.limitBytes) {
        outgoing.destroy();
        await unlinkTolerant(temporaryPath);
        return { kind: 'limit-exceeded', limitBytes: input.limitBytes };
      }

      if (!outgoing.write(chunk)) {
        await once(outgoing, 'drain');
      }
    }
  } catch {
    outgoing.destroy();
    await unlinkTolerant(temporaryPath);
    return { kind: 'aborted' };
  }

  await new Promise<void>((resolve, reject) => {
    outgoing.end((error?: Error | null) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  if (bytesWritten !== input.expectedBytes) {
    await unlinkTolerant(temporaryPath);
    return { kind: 'aborted' };
  }

  return { kind: 'written', temporaryPath, bytesWritten };
}

function createConfinedNodeObjectStorage(store: StoreConfig): ObjectStorage {
  const confine = (path: string): string => assertInsideMediaRoot(store, path);

  return {
    stat: async (path) => statPath(confine(path)),
    listDirectory: async (path) => listDirectoryEntries(confine(path)),
    ensureDirectory: async (path) => {
      await mkdir(confine(path), { recursive: true });
    },
    readTextFile: async (path) => readFile(confine(path), 'utf8'),
    writeTextFile: async (path, contents) => {
      await writeFile(confine(path), contents, 'utf8');
    },
    openReadStream: (path, range) => readFileRange(confine(path), range),
    writeTemporary: async (input) =>
      writeTemporaryStreaming({ ...input, directory: confine(input.directory) }),
    promoteTemporary: async (temporaryPath, finalPath) => {
      await rename(confine(temporaryPath), confine(finalPath));
    },
    removeTemporary: async (path) => unlinkTolerant(confine(path)),
    removeFile: async (path) => unlinkTolerant(confine(path)),
    removeDirectory: async (path) => {
      await rm(confine(path), { recursive: true, force: true });
    },
    copyFile: async (from, to) => {
      await copyFile(confine(from), confine(to));
    },
    realPath: async (path) => {
      try {
        return await realpath(confine(path));
      } catch (error) {
        if (isEnoent(error)) {
          return null;
        }
        throw error;
      }
    },
  };
}

function spawnProducerProcess(input: SpawnProducerProcessInput): SpawnedProducerProcess {
  const child = spawn(input.command, [...input.args], {
    cwd: input.cwd,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout?.setEncoding('utf8');
  child.stderr?.setEncoding('utf8');

  return {
    onStdout: (listener) => {
      child.stdout?.on('data', (chunk: string) => listener(chunk));
    },
    onStderr: (listener) => {
      child.stderr?.on('data', (chunk: string) => listener(chunk));
    },
    onExit: (listener) => {
      child.on('close', (exitCode, signal) => listener(exitCode, signal));
    },
    onSpawnError: (listener) => {
      child.on('error', (error) => listener(error));
    },
    kill: (signal) => {
      child.kill(signal);
    },
  };
}

function scheduleNodeTimeout(callback: () => void, ms: number): () => void {
  const handle = setTimeout(callback, ms);
  handle.unref();
  return () => clearTimeout(handle);
}

export function createNodeRenderApiDependencies(
  env: NodeJS.ProcessEnv,
  store: StoreConfig,
): RenderApiDependencies {
  const server = readServerConfig(env);
  const producerConfig = readProducerConfig(
    env,
    process.cwd(),
    `http://${server.host}:${server.port}`,
  );
  let mediaLocalModule: Promise<typeof import('@video-maker/media-local')> | null = null;
  let renderModule: Promise<typeof import('@video-maker/composition-remotion/render')> | null = null;
  let binaries: Promise<ResolvedMediaBinaries> | null = null;
  let voiceBinaries: Promise<ResolvedVoiceBinaries> | null = null;

  const loadMediaLocal = (): Promise<typeof import('@video-maker/media-local')> => {
    mediaLocalModule ??= import('@video-maker/media-local');
    return mediaLocalModule;
  };

  const loadRender = (): Promise<typeof import('@video-maker/composition-remotion/render')> => {
    renderModule ??= import('@video-maker/composition-remotion/render');
    return renderModule;
  };

  const loadVoiceBinaries = (): Promise<ResolvedVoiceBinaries> => {
    voiceBinaries ??= (async () => {
      const { resolveVoiceBinaries } = await loadMediaLocal();
      return resolveVoiceBinaries(env);
    })();
    return voiceBinaries;
  };

  const loadBinaries = (): Promise<ResolvedMediaBinaries> => {
    binaries ??= (async () => {
      const { resolveBinary } = await loadMediaLocal();
      const [ffmpeg, ffprobe] = await Promise.all([
        resolveBinary('ffmpeg', env),
        resolveBinary('ffprobe', env),
      ]);
      return { ffmpeg, ffprobe };
    })();
    return binaries;
  };

  return {
    renderMutedVideo: async ({ timeline, outPath, publicDir, onProgress }) => {
      const { renderTimeline } = await loadRender();
      const result = await renderTimeline(timeline, {
        outPath,
        publicDir,
        audio: 'muted',
        ...(onProgress === undefined ? {} : { onProgress }),
      });
      return {
        outPath: result.outPath,
        width: result.width,
        height: result.height,
        fps: result.fps,
        durationInFrames: result.durationInFrames,
      };
    },

    mixTimelineAudio: async ({ timeline, outPath, projectRoot }) => {
      const { ExecaCommandRunner, mixTimelineAudio } = await loadMediaLocal();
      const { ffmpeg } = await loadBinaries();
      const result = await mixTimelineAudio(timeline, outPath, new ExecaCommandRunner(), {
        ffmpegPath: ffmpeg,
        runOptions: { cwd: projectRoot },
      });
      return { outputPath: result.outputPath, filterComplex: result.filterComplex };
    },

    muxAudioIntoVideo: async ({ videoPath, audioPath, outPath }) => {
      const { ExecaCommandRunner, muxAudioIntoVideo } = await loadMediaLocal();
      const { ffmpeg, ffprobe } = await loadBinaries();
      const result = await muxAudioIntoVideo(videoPath, audioPath, outPath, new ExecaCommandRunner(), {
        ffmpegPath: ffmpeg,
        ffprobePath: ffprobe,
      });
      return { outputPath: result.outputPath };
    },

    verifyMixLoudness: async ({ path, target }) => {
      const { ExecaCommandRunner, verifyMixLoudness } = await loadMediaLocal();
      const { ffmpeg } = await loadBinaries();
      return verifyMixLoudness(path, target, new ExecaCommandRunner(), { ffmpegPath: ffmpeg });
    },

    ensureDirectory: async (path) => {
      await mkdir(path, { recursive: true });
    },

    probeMediaBinaries: async () => {
      const { BINARY_ENV_VARS, resolveBinary } = await loadMediaLocal();
      const statuses: BinaryStatus[] = [];
      for (const name of MEDIA_BINARY_NAMES) {
        const envVar = BINARY_ENV_VARS[name];
        try {
          await resolveBinary(name, env);
          statuses.push({ name, envVar, resolved: true });
        } catch {
          statuses.push({ name, envVar, resolved: false });
        }
      }
      return statuses;
    },

    preloadEngineModules: async () => {
      const loaders: Record<(typeof ENGINE_MODULE_NAMES)[number], () => Promise<unknown>> = {
        'media-local': loadMediaLocal,
        'composition-remotion/render': loadRender,
      };
      const statuses: EngineModuleStatus[] = [];
      for (const name of ENGINE_MODULE_NAMES) {
        try {
          await loaders[name]();
          statuses.push({ name, loaded: true });
        } catch {
          statuses.push({ name, loaded: false });
        }
      }
      return statuses;
    },

    storage: createConfinedNodeObjectStorage(store),

    probeAsset: async ({ path }) => {
      const { ExecaCommandRunner, probeMedia } = await loadMediaLocal();
      const { ffprobe } = await loadBinaries();
      return probeMedia(path, new ExecaCommandRunner(), { ffprobePath: ffprobe });
    },

    extractFrame: async ({ path, atSeconds, outPath, maxLongSidePx, projectRoot }) => {
      const { ExecaCommandRunner, extractFrame: runExtractFrame } = await loadMediaLocal();
      const { ffmpeg } = await loadBinaries();
      await runExtractFrame(path, atSeconds, outPath, new ExecaCommandRunner(), {
        maxLongSidePx,
        ffmpegPath: ffmpeg,
        runOptions: { cwd: projectRoot },
      });
    },

    fetchRemote: async (url, init) => {
      const response = await fetch(url, {
        ...(init.headers === undefined ? {} : { headers: init.headers }),
        signal: AbortSignal.timeout(init.timeoutMs),
      });

      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });

      return {
        status: response.status,
        headers,
        body: () =>
          response.body === null
            ? emptyAsyncIterable()
            : Readable.fromWeb(response.body as unknown as NodeReadableStreamWeb),
      };
    },

    buildKenBurnsClip: async ({ photoPath, frames, fps, outPath, projectRoot }) => {
      const { buildKenBurnsClip: runBuildKenBurnsClip, ExecaCommandRunner } = await loadMediaLocal();
      const { ffmpeg } = await loadBinaries();
      await runBuildKenBurnsClip(photoPath, frames, outPath, new ExecaCommandRunner(), {
        fps,
        ffmpegPath: ffmpeg,
        runOptions: { cwd: projectRoot },
      });
    },

    concatVideoClips: async ({ listPath, outPath, projectRoot }) => {
      const { concatVideoClips: runConcatVideoClips, ExecaCommandRunner } = await loadMediaLocal();
      const { ffmpeg } = await loadBinaries();
      await runConcatVideoClips(listPath, outPath, new ExecaCommandRunner(), {
        ffmpegPath: ffmpeg,
        runOptions: { cwd: projectRoot },
      });
    },

    randomId: () => randomUUID(),

    clock: { nowIso: () => new Date().toISOString() },

    logger: {
      info: () => undefined,
      error: () => undefined,
    },

    readDirectory: nodeDirectoryReader,
    statFile: nodeFileStatReader,

    createCommandRunner: async () => {
      const { ExecaCommandRunner } = await loadMediaLocal();
      return new ExecaCommandRunner();
    },

    resolveMontageBinaries: async () => {
      const { resolveBinaries } = await loadMediaLocal();
      return resolveBinaries(env);
    },

    aiAgent: async (request) => {
      const { ExecaCommandRunner } = await loadMediaLocal();
      const config = readAiAgentConfig(env, tmpdir());
      return createClaudeCliAiAgent(new ExecaCommandRunner(), config)(request);
    },

    producerAgent: createClaudeCodeProducerAgent(
      spawnProducerProcess,
      producerConfig,
      scheduleNodeTimeout,
    ),

    probeProducerBinary: async () => {
      const { nodeBinaryLookup } = await loadMediaLocal();
      if (producerConfig.binaryPath.includes('/')) {
        return nodeBinaryLookup.isExecutableFile(producerConfig.binaryPath);
      }
      for (const directory of (env.PATH ?? '').split(':').filter((entry) => entry !== '')) {
        if (await nodeBinaryLookup.isExecutableFile(join(directory, producerConfig.binaryPath))) {
          return true;
        }
      }
      return false;
    },

    resolveVoiceBinaries: async () => {
      const { resolveVoiceBinaries } = await loadMediaLocal();
      return resolveVoiceBinaries(env);
    },

    voicePreviewCache: createNodeVoicePreviewCache(
      readVoicePreviewConfig(env, tmpdir()).cacheDirectory,
    ),

    listVoiceModels: async () => {
      const { buildVoiceCatalog, resolveBinary, voiceModelConfigFileName } = await loadMediaLocal();
      const modelPath = await resolveBinary('piperModel', env);
      const voicesDirectory = dirname(modelPath);
      const entries = await readdir(voicesDirectory, { withFileTypes: true });
      const fileNames = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
      const present = new Set(fileNames);
      const files = await Promise.all(
        fileNames.map(async (fileName) => ({
          fileName,
          config: present.has(voiceModelConfigFileName(fileName))
            ? await readVoiceModelConfig(join(voicesDirectory, voiceModelConfigFileName(fileName)))
            : null,
        })),
      );
      return buildVoiceCatalog(files, modelPath);
    },

    synthesizeVoice: async ({ textPath, outPath, modelPath, lengthScale, projectRoot }) => {
      const { ExecaCommandRunner, synthesizeSpeech } = await loadMediaLocal();
      const { piperCli } = await loadVoiceBinaries();
      await synthesizeSpeech(
        outPath,
        {
          modelPath,
          textPath,
          piperPath: piperCli,
          runOptions: { cwd: projectRoot },
          ...(lengthScale === undefined ? {} : { lengthScale }),
        },
        new ExecaCommandRunner(),
      );
    },

    extractVoiceAudio: async ({ inputPath, outPath, sampleRate, channels, projectRoot }) => {
      const { ExecaCommandRunner, extractAudioForTranscription } = await loadMediaLocal();
      const { ffmpeg } = await loadBinaries();
      await extractAudioForTranscription(inputPath, outPath, new ExecaCommandRunner(), {
        sampleRate,
        channels,
        ffmpegPath: ffmpeg,
        runOptions: { cwd: projectRoot },
      });
    },

    concatVoiceTracks: async ({ inputPaths, outPath, gapMs, sampleRate, channels, projectRoot }) => {
      const { ExecaCommandRunner, concatSpeechSegments } = await loadMediaLocal();
      const { ffmpeg } = await loadBinaries();
      await concatSpeechSegments(
        outPath,
        { inputPaths, gapMs, sampleRate, channels, ffmpegPath: ffmpeg, runOptions: { cwd: projectRoot } },
        new ExecaCommandRunner(),
      );
    },

    placeVoiceTracks: async ({ segments, totalMs, outPath, sampleRate, channels, projectRoot }) => {
      const { ExecaCommandRunner, placeSpeechSegments } = await loadMediaLocal();
      const { ffmpeg } = await loadBinaries();
      await placeSpeechSegments(
        outPath,
        {
          segments,
          sampleRate,
          channels,
          ffmpegPath: ffmpeg,
          runOptions: { cwd: projectRoot },
          ...(totalMs === null ? {} : { totalMs }),
        },
        new ExecaCommandRunner(),
      );
    },

    transcribeVoice: async ({ wavPath, outBase, assetId, language, projectRoot }) => {
      const { ExecaCommandRunner, transcribeWithWhisperCpp } = await loadMediaLocal();
      const { whisperCli, whisperModel } = await loadVoiceBinaries();
      return transcribeWithWhisperCpp(
        wavPath,
        {
          modelPath: whisperModel,
          outBase,
          assetId,
          language,
          whisperPath: whisperCli,
          runOptions: { cwd: projectRoot },
        },
        new ExecaCommandRunner(),
      );
    },
  };
}
