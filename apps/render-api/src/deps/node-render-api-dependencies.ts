import { once } from 'node:events';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative } from 'node:path/posix';

import { nodeDirectoryReader, nodeFileStatReader } from '@video-maker/auto-montage';

import { createClaudeCliAiAgent } from '../ai/claude-cli-ai-agent';
import { readAiAgentConfig } from '../config/ai-agent-config';
import type { StoreConfig } from '../config/store-config';
import { ENGINE_MODULE_NAMES } from '../engine/engine-modules';
import type { EngineModuleStatus } from '../engine/engine-modules';
import { MEDIA_BINARY_NAMES } from '../engine/media-binaries';
import type { BinaryStatus, ResolvedMediaBinaries } from '../engine/media-binaries';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import type { ByteRange, ObjectStorage, WriteTemporaryInput, WriteTemporaryOutcome } from './object-storage';
import type { RenderApiDependencies } from './render-api-dependencies';

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

async function* readFileRange(path: string, range?: ByteRange): AsyncGenerator<Uint8Array> {
  const options = range ? { start: range.start, end: range.end } : {};
  for await (const chunk of createReadStream(path, options)) {
    yield chunk as Uint8Array;
  }
}

async function removeTemporaryTolerant(path: string): Promise<void> {
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
        await removeTemporaryTolerant(temporaryPath);
        return { kind: 'limit-exceeded', limitBytes: input.limitBytes };
      }

      if (!outgoing.write(chunk)) {
        await once(outgoing, 'drain');
      }
    }
  } catch {
    outgoing.destroy();
    await removeTemporaryTolerant(temporaryPath);
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
    await removeTemporaryTolerant(temporaryPath);
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
    removeTemporary: async (path) => removeTemporaryTolerant(confine(path)),
  };
}

export function createNodeRenderApiDependencies(
  env: NodeJS.ProcessEnv,
  store: StoreConfig,
): RenderApiDependencies {
  let mediaLocalModule: Promise<typeof import('@video-maker/media-local')> | null = null;
  let renderModule: Promise<typeof import('@video-maker/composition-remotion/render')> | null = null;
  let binaries: Promise<ResolvedMediaBinaries> | null = null;

  const loadMediaLocal = (): Promise<typeof import('@video-maker/media-local')> => {
    mediaLocalModule ??= import('@video-maker/media-local');
    return mediaLocalModule;
  };

  const loadRender = (): Promise<typeof import('@video-maker/composition-remotion/render')> => {
    renderModule ??= import('@video-maker/composition-remotion/render');
    return renderModule;
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
  };
}
