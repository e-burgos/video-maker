import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createReadStream, createWriteStream } from 'node:fs';
import {
  copyFile,
  link,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { homedir, tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative } from 'node:path/posix';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStreamWeb } from 'node:stream/web';

import { nodeDirectoryReader, nodeFileStatReader } from '@video-maker/auto-montage';
import {
  createAssetsRepository,
  createJobsRepository,
  createOrganizationRepository,
  createProducerRepository,
  createProjectsRepository,
  createPublicationsRepository,
  createPublishQueueRepository,
  createSettingsRepository,
  currentUserVersion,
  openStudioDatabase,
} from '@video-maker/local-store';
import type { StudioDatabase } from '@video-maker/local-store';

import { listMotionBrandDocuments, createMotionPipelinePorts } from './motion-pipeline-adapters';
import { HYPERFRAMES_RESOLVE_FROM_ENV_VAR, resolveHyperframesCli } from './hyperframes-cli';
import { startOAuthLoopbackServer } from './oauth-loopback';
import { rasterizeSvgWithBrowser, resolveHeadlessBrowser } from './svg-rasterizer';
import { createClaudeCliAiAgent } from '../ai/claude-cli-ai-agent';
import { createEffectiveAiAgent } from '../ai/effective-ai-agent';
import { readAiAgentConfig } from '../config/ai-agent-config';
import { allowlistedChildEnv } from '../config/child-process-env';
import { readProducerConfig } from '../config/producer-config';
import { readRemotionConfig } from '../config/remotion-config';
import { readServerConfig } from '../config/server-config';
import { readVoicePreviewConfig } from '../config/voice-preview-config';
import { readElevenLabsCacheDirectory } from '../config/voice-synthesis-cache-config';
import { createNodeElevenLabsSynthesizer } from '../voice/node-elevenlabs-synthesizer';
import { createVoiceSynthesisDispatcher } from '../voice/synthesize-voice-dispatch';
import { createClaudeCodeProducerAgent } from '../producer/claude-code-producer-agent';
import { createOpenRouterModelCatalog } from '../producer/openrouter-model-catalog';
import type { SpawnedProducerProcess, SpawnProducerProcessInput } from '../producer/producer-agent';
import type { StoreConfig } from '../config/store-config';
import { ENGINE_MODULE_NAMES } from '../engine/engine-modules';
import type { EngineModuleStatus } from '../engine/engine-modules';
import { MEDIA_BINARY_NAMES } from '../engine/media-binaries';
import type { BinaryStatus, ResolvedMediaBinaries } from '../engine/media-binaries';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import {
  createKeychainSecretStore,
  createNodeSecretStoreCommandRunner,
  readKeychainServiceName,
} from '../secrets/keychain-secret-store';
import type { CommandRunner, ResolvedVoiceBinaries } from '@video-maker/media-local';

import type { ByteRange, ObjectStorage, WriteTemporaryInput, WriteTemporaryOutcome } from './object-storage';
import type {
  AiAgentPort,
  LocalStorePort,
  RenderApiDependencies,
  SynthesizeVoicePort,
  VoicePreviewCache,
} from './render-api-dependencies';

const HYPERFRAMES_TIMEOUT_MS = 3 * 60 * 60 * 1000;
const HYPERFRAMES_PASSTHROUGH_KEYS = ['REMOTION_BROWSER_EXECUTABLE', HYPERFRAMES_RESOLVE_FROM_ENV_VAR] as const;

function pickEnv(env: NodeJS.ProcessEnv, keys: readonly string[]): NodeJS.ProcessEnv {
  return Object.fromEntries(keys.flatMap((key) => (env[key] === undefined ? [] : [[key, env[key]]])));
}

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

const PREBUILT_BUNDLE_PUBLIC_DIR_NAME = 'public';

async function ensurePrebuiltBundlePublicDir(serveUrl: string, publicDir: string): Promise<void> {
  const linkPath = join(serveUrl, PREBUILT_BUNDLE_PUBLIC_DIR_NAME);
  try {
    const existing = await lstat(linkPath);
    if (existing.isSymbolicLink() && (await realpath(linkPath)) === (await realpath(publicDir))) {
      return;
    }
    await rm(linkPath, { recursive: true, force: true });
  } catch (error) {
    if (!isEnoent(error)) {
      throw error;
    }
  }
  await symlink(publicDir, linkPath, 'dir');
}

async function directoryExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch (error) {
    if (isEnoent(error)) {
      return false;
    }
    throw error;
  }
}

const REMOTION_BUNDLE_CACHE_DIR_NAME = 'remotion-bundle';
const REMOTION_BUNDLE_FINGERPRINT_FILE_NAME = 'bundle.js';

async function fingerprintDirectory(dirPath: string): Promise<string> {
  const contents = await readFile(join(dirPath, REMOTION_BUNDLE_FINGERPRINT_FILE_NAME));
  return createHash('sha256').update(contents).digest('hex').slice(0, 16);
}

async function linkOrCopyFile(sourcePath: string, destPath: string): Promise<void> {
  try {
    await link(sourcePath, destPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EXDEV') {
      throw error;
    }
    await copyFile(sourcePath, destPath);
  }
}

async function linkOrCopyDirectoryRecursive(sourceDir: string, destDir: string): Promise<void> {
  await mkdir(destDir, { recursive: true });
  const entries = await readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = join(sourceDir, entry.name);
    const destPath = join(destDir, entry.name);
    if (entry.isDirectory()) {
      await linkOrCopyDirectoryRecursive(sourcePath, destPath);
    } else if (entry.isFile()) {
      await linkOrCopyFile(sourcePath, destPath);
    }
  }
}

async function ensureWritableRemotionBundle(sourceServeUrl: string, cacheParentDir: string): Promise<string> {
  const fingerprint = await fingerprintDirectory(sourceServeUrl);
  const targetDir = join(cacheParentDir, REMOTION_BUNDLE_CACHE_DIR_NAME, fingerprint);
  if (await directoryExists(targetDir)) {
    return targetDir;
  }

  const stagingDir = `${targetDir}.staging-${randomUUID()}`;
  await linkOrCopyDirectoryRecursive(sourceServeUrl, stagingDir);
  await mkdir(join(cacheParentDir, REMOTION_BUNDLE_CACHE_DIR_NAME), { recursive: true });
  await rename(stagingDir, targetDir);
  return targetDir;
}

async function findOnnxFileName(voiceDirPath: string): Promise<string> {
  const entries = await readdir(voiceDirPath, { withFileTypes: true });
  const onnxFile = entries.find((entry) => entry.isFile() && entry.name.endsWith('.onnx'));
  if (onnxFile === undefined) {
    throw new PipelineStageError({
      code: 'VOICE_MODEL_UNAVAILABLE',
      stage: null,
      resource: voiceDirPath,
      expected: 'a .onnx model file inside the voice directory',
    });
  }
  return onnxFile.name;
}

function isInside(root: string, path: string): boolean {
  const relativePath = relative(root, path);
  return !relativePath.startsWith('..') && !isAbsolute(relativePath);
}

function assertInsideMediaRoot(store: StoreConfig, path: string): string {
  const allowedRoots = [store.mediaRoot, store.brandsRoot, join(store.motionAssetsRoot, 'brands')];
  if (!allowedRoots.some((root) => isInside(root, path))) {
    throw new PipelineStageError({
      code: 'ASSET_PATH_INVALID',
      stage: null,
      resource: relative(store.mediaRoot, path),
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
    env: allowlistedChildEnv(process.env),
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
    tmpdir(),
  );
  let mediaLocalModule: Promise<typeof import('@video-maker/media-local')> | null = null;
  let renderModule: Promise<typeof import('@video-maker/composition-remotion/render')> | null = null;
  let binaries: Promise<ResolvedMediaBinaries> | null = null;
  let voiceBinaries: Promise<ResolvedVoiceBinaries> | null = null;
  let studioDatabase: StudioDatabase | null = null;
  let localStorePort: LocalStorePort | null = null;
  let commandRunner: Promise<CommandRunner> | null = null;
  let effectiveAiAgent: AiAgentPort | null = null;
  const childEnv = allowlistedChildEnv(env);
  const secretStore = createKeychainSecretStore({
    service: readKeychainServiceName(env),
    runner: createNodeSecretStoreCommandRunner(),
  });
  const openRouterModelCatalog = createOpenRouterModelCatalog();

  const claudeCliAgent: AiAgentPort = async (request) => {
    const config = readAiAgentConfig(env, tmpdir());
    const runner = await loadCommandRunner();
    return createClaudeCliAiAgent(runner, config)(request);
  };

  const nowIso = (): string => new Date().toISOString();

  const loadStudioDatabase = (): StudioDatabase => {
    studioDatabase ??= openStudioDatabase(store.dbPath);
    return studioDatabase;
  };

  const loadLocalStore = (): LocalStorePort => {
    if (localStorePort === null) {
      const database = loadStudioDatabase();
      localStorePort = {
        projects: createProjectsRepository(database.db, nowIso),
        organization: createOrganizationRepository(database.db),
        producer: createProducerRepository(database.db),
        jobs: createJobsRepository(database.db),
        settings: createSettingsRepository(database.db, nowIso),
        assets: createAssetsRepository(database.db, nowIso),
        publications: createPublicationsRepository(database.db),
        publishQueue: createPublishQueueRepository(database.db),
        schemaVersion: currentUserVersion(database.sqlite),
        close: () => database.close(),
      };
    }
    return localStorePort;
  };

  const loadMediaLocal = (): Promise<typeof import('@video-maker/media-local')> => {
    mediaLocalModule ??= import('@video-maker/media-local');
    return mediaLocalModule;
  };

  const loadCommandRunner = (): Promise<CommandRunner> => {
    commandRunner ??= (async () => {
      const { ExecaCommandRunner } = await loadMediaLocal();
      return new ExecaCommandRunner({ env: childEnv });
    })();
    return commandRunner;
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

  const remotion = readRemotionConfig(env);
  let writableRemotionServeUrl: Promise<string> | null = null;

  const loadWritableRemotionServeUrl = (sourceServeUrl: string): Promise<string> => {
    writableRemotionServeUrl ??= ensureWritableRemotionBundle(sourceServeUrl, dirname(store.dbPath));
    return writableRemotionServeUrl;
  };

  const synthesizePiperVoice: SynthesizeVoicePort = async ({ textPath, outPath, modelPath: voiceDirPath, lengthScale, noiseScale, noiseScaleW, trailingPauseMs, projectRoot }) => {
    const { synthesizeSpeech, VOICE_ESPEAK_DATA_DIR_NAME, VOICE_TOKENS_FILE_NAME } = await loadMediaLocal();
    const [{ ttsCli }, runner] = await Promise.all([loadVoiceBinaries(), loadCommandRunner()]);
    const voicesDirectory = dirname(voiceDirPath);
    const ownDataDirPath = join(voiceDirPath, VOICE_ESPEAK_DATA_DIR_NAME);
    const dataDirPath = (await directoryExists(ownDataDirPath))
      ? ownDataDirPath
      : join(voicesDirectory, VOICE_ESPEAK_DATA_DIR_NAME);
    const onnxFileName = await findOnnxFileName(voiceDirPath);

    await synthesizeSpeech(
      outPath,
      {
        modelPath: join(voiceDirPath, onnxFileName),
        tokensPath: join(voiceDirPath, VOICE_TOKENS_FILE_NAME),
        dataDirPath,
        textPath,
        ttsPath: ttsCli,
        runOptions: { cwd: projectRoot },
        ...(lengthScale === undefined ? {} : { lengthScale }),
        ...(noiseScale === undefined ? {} : { noiseScale }),
        ...(noiseScaleW === undefined ? {} : { noiseScaleW }),
        ...(trailingPauseMs === undefined ? {} : { trailingPauseMs, ffmpegPath: (await loadBinaries()).ffmpeg }),
      },
      runner,
    );
  };

  const synthesizeVoiceByEngine = createVoiceSynthesisDispatcher({
    piper: synthesizePiperVoice,
    elevenlabs: createNodeElevenLabsSynthesizer({
      fetchRemote: (url, init) => deps.fetchRemote(url, init),
      readSecret: (name) => secretStore.get(name),
      cacheDirectory: readElevenLabsCacheDirectory(env, homedir()),
      ffmpegPath: async () => (await loadBinaries()).ffmpeg,
      commandRunner: loadCommandRunner,
      appendSilence: async (inputPath, outPath, silenceMs, ffmpegPath, runner) => {
        const { appendTrailingSilence } = await loadMediaLocal();
        await appendTrailingSilence(inputPath, outPath, { silenceMs, ffmpegPath }, runner);
      },
    }),
  });

  const deps: RenderApiDependencies = {
    renderMutedVideo: async ({ timeline, outPath, publicDir, sampleSeconds, onProgress }) => {
      const { renderTimeline } = await loadRender();
      const serveUrl =
        remotion.serveUrl === null ? null : await loadWritableRemotionServeUrl(remotion.serveUrl);
      if (serveUrl !== null) {
        await ensurePrebuiltBundlePublicDir(serveUrl, publicDir);
      }
      const result = await renderTimeline(timeline, {
        outPath,
        publicDir,
        audio: 'muted',
        ...(sampleSeconds === undefined ? {} : { sampleSeconds }),
        ...(serveUrl === null ? {} : { serveUrl }),
        ...(remotion.browserExecutable === null ? {} : { browserExecutable: remotion.browserExecutable }),
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
      const { mixTimelineAudio, normalizeMasterLoudness } = await loadMediaLocal();
      const [{ ffmpeg }, runner] = await Promise.all([loadBinaries(), loadCommandRunner()]);
      const options = { ffmpegPath: ffmpeg, runOptions: { cwd: projectRoot } };
      const result = await mixTimelineAudio(timeline, outPath, runner, options);
      await normalizeMasterLoudness(result.outputPath, timeline.audioMix.voice, runner, options);
      return { outputPath: result.outputPath, filterComplex: result.filterComplex };
    },

    muxAudioIntoVideo: async ({ videoPath, audioPath, outPath }) => {
      const { muxAudioIntoVideo } = await loadMediaLocal();
      const [{ ffmpeg, ffprobe }, runner] = await Promise.all([loadBinaries(), loadCommandRunner()]);
      const result = await muxAudioIntoVideo(videoPath, audioPath, outPath, runner, {
        ffmpegPath: ffmpeg,
        ffprobePath: ffprobe,
      });
      return { outputPath: result.outputPath };
    },

    verifyMixLoudness: async ({ path, target }) => {
      const { verifyMixLoudness } = await loadMediaLocal();
      const [{ ffmpeg }, runner] = await Promise.all([loadBinaries(), loadCommandRunner()]);
      return verifyMixLoudness(path, target, runner, { ffmpegPath: ffmpeg });
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

    get localStore() {
      return loadLocalStore();
    },

    hashText: (text) => createHash('sha256').update(text, 'utf8').digest('hex'),

    probeAsset: async ({ path }) => {
      const { probeMedia } = await loadMediaLocal();
      const [{ ffprobe }, runner] = await Promise.all([loadBinaries(), loadCommandRunner()]);
      return probeMedia(path, runner, { ffprobePath: ffprobe });
    },

    extractFrame: async ({ path, atSeconds, outPath, maxLongSidePx, projectRoot }) => {
      const { extractFrame: runExtractFrame } = await loadMediaLocal();
      const [{ ffmpeg }, runner] = await Promise.all([loadBinaries(), loadCommandRunner()]);
      await runExtractFrame(path, atSeconds, outPath, runner, {
        maxLongSidePx,
        ffmpegPath: ffmpeg,
        runOptions: { cwd: projectRoot },
      });
    },

    resizeImage: async ({ path, outPath, maxLongSidePx, projectRoot }) => {
      const { resizeImage: runResizeImage } = await loadMediaLocal();
      const [{ ffmpeg }, runner] = await Promise.all([loadBinaries(), loadCommandRunner()]);
      await runResizeImage(path, outPath, runner, {
        maxLongSidePx,
        ffmpegPath: ffmpeg,
        runOptions: { cwd: projectRoot },
      });
    },

    fetchRemote: async (url, init) => {
      const method = init.method ?? 'GET';
      const response = await fetch(url, {
        method,
        ...(init.headers === undefined ? {} : { headers: init.headers }),
        ...(init.body === undefined ? {} : { body: init.body as BodyInit }),
        ...(method === 'GET' ? {} : { redirect: 'manual' as const }),
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
      const { buildKenBurnsClip: runBuildKenBurnsClip } = await loadMediaLocal();
      const [{ ffmpeg }, runner] = await Promise.all([loadBinaries(), loadCommandRunner()]);
      await runBuildKenBurnsClip(photoPath, frames, outPath, runner, {
        fps,
        ffmpegPath: ffmpeg,
        runOptions: { cwd: projectRoot },
      });
    },

    concatVideoClips: async ({ listPath, outPath, projectRoot }) => {
      const { concatVideoClips: runConcatVideoClips } = await loadMediaLocal();
      const [{ ffmpeg }, runner] = await Promise.all([loadBinaries(), loadCommandRunner()]);
      await runConcatVideoClips(listPath, outPath, runner, {
        ffmpegPath: ffmpeg,
        runOptions: { cwd: projectRoot },
      });
    },

    randomId: () => randomUUID(),

    clock: { nowIso },

    logger: {
      info: () => undefined,
      error: () => undefined,
    },

    readDirectory: nodeDirectoryReader,
    statFile: nodeFileStatReader,

    createCommandRunner: async () => {
      const { ExecaCommandRunner } = await loadMediaLocal();
      return new ExecaCommandRunner({ env: childEnv });
    },

    resolveMontageBinaries: async () => {
      const { resolveBinaries } = await loadMediaLocal();
      return resolveBinaries(env);
    },

    aiAgent: async (request) => {
      effectiveAiAgent ??= createEffectiveAiAgent(deps, claudeCliAgent, openRouterModelCatalog);
      return effectiveAiAgent(request);
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
      const { buildVoiceCatalog, resolveBinary, voiceIdFromDirectoryName, voiceModelConfigFileName } =
        await loadMediaLocal();
      const voicesDirectory = await resolveBinary('ttsVoicesDir', env);
      const entries = await readdir(voicesDirectory, { withFileTypes: true });
      const voiceDirectories = entries.filter(
        (entry) => entry.isDirectory() && voiceIdFromDirectoryName(entry.name) !== null,
      );
      const files = await Promise.all(
        voiceDirectories.map(async (entry) => {
          const voiceId = voiceIdFromDirectoryName(entry.name) as string;
          const fileName = `${voiceId}.onnx`;
          const configPath = join(voicesDirectory, entry.name, voiceModelConfigFileName(fileName));
          return { directory: entry.name, fileName, config: await readVoiceModelConfig(configPath) };
        }),
      );
      return buildVoiceCatalog(files);
    },

    synthesizeVoice: (input) => synthesizeVoiceByEngine(input),

    extractVoiceAudio: async ({ inputPath, outPath, sampleRate, channels, projectRoot }) => {
      const { extractAudioForTranscription } = await loadMediaLocal();
      const [{ ffmpeg }, runner] = await Promise.all([loadBinaries(), loadCommandRunner()]);
      await extractAudioForTranscription(inputPath, outPath, runner, {
        sampleRate,
        channels,
        ffmpegPath: ffmpeg,
        runOptions: { cwd: projectRoot },
      });
    },

    concatVoiceTracks: async ({ inputPaths, outPath, gapMs, sampleRate, channels, projectRoot }) => {
      const { concatSpeechSegments } = await loadMediaLocal();
      const [{ ffmpeg }, runner] = await Promise.all([loadBinaries(), loadCommandRunner()]);
      await concatSpeechSegments(
        outPath,
        { inputPaths, gapMs, sampleRate, channels, ffmpegPath: ffmpeg, runOptions: { cwd: projectRoot } },
        runner,
      );
    },

    placeVoiceTracks: async ({ segments, totalMs, outPath, sampleRate, channels, projectRoot }) => {
      const { placeSpeechSegments } = await loadMediaLocal();
      const [{ ffmpeg }, runner] = await Promise.all([loadBinaries(), loadCommandRunner()]);
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
        runner,
      );
    },

    transcribeVoice: async ({ wavPath, outBase, assetId, language, projectRoot }) => {
      const { transcribeWithWhisperCpp } = await loadMediaLocal();
      const [{ whisperCli, whisperModel }, runner] = await Promise.all([loadVoiceBinaries(), loadCommandRunner()]);
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
        runner,
      );
    },

    secretStore,

    listMotionBrands: () =>
      listMotionBrandDocuments(
        { builtInAssetsRoot: store.motionAssetsRoot, userBrandsRoot: store.brandsRoot },
        { skipped: ({ id, why }) => deps.logger.error({ event: 'brand-skipped', detail: { id, why } }) },
      ),

    motionPorts: () => createMotionPipelinePorts(deps, store.motionAssetsRoot, store.brandsRoot),

    runHyperframes: async ({ args, cwd }) => {
      const invocation = resolveHyperframesCli({
        env: { ...childEnv, ...pickEnv(env, HYPERFRAMES_PASSTHROUGH_KEYS) },
        execPath: process.execPath,
        isElectron: process.versions.electron !== undefined,
      });
      const { ExecaCommandRunner } = await loadMediaLocal();
      const result = await new ExecaCommandRunner({ env: invocation.env }).run(
        invocation.command,
        [...invocation.args, ...args],
        { cwd, timeoutMs: HYPERFRAMES_TIMEOUT_MS },
      );
      return { exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr };
    },

    rasterizeSvg: async (input) => {
      const browser = await resolveHeadlessBrowser(remotion.browserExecutable, process.cwd());
      if (browser === null) {
        throw new PipelineStageError({
          code: 'BRAND_LOGO_RASTERIZE_FAILED',
          stage: null,
          resource: input.svgPath,
          expected: 'a headless browser (REMOTION_BROWSER_EXECUTABLE or the Remotion chrome-headless-shell)',
        });
      }
      const runner = await loadCommandRunner();
      try {
        await rasterizeSvgWithBrowser(input, browser, async (binary, args, timeoutMs) => {
          const result = await runner.run(binary, args, { timeoutMs });
          return { exitCode: result.exitCode, stderr: result.stderr };
        });
      } catch (cause) {
        throw new PipelineStageError({
          code: 'BRAND_LOGO_RASTERIZE_FAILED',
          stage: null,
          resource: input.svgPath,
          hint: cause instanceof Error ? cause.message : String(cause),
          cause,
        });
      }
    },

    startOAuthLoopback: startOAuthLoopbackServer,
  };

  return deps;
}
