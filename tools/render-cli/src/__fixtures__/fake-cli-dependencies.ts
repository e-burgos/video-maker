import type { DirectoryEntry, DirectoryReader, EnsureDirectory, FileStatReader, WriteTextFile } from '@video-maker/auto-montage';
import type { Clock, CommandRunner, ReadTextFile, ResolvedBinaries } from '@video-maker/media-local';
import { FixtureCommandRunner, systemClock } from '@video-maker/media-local';

import type { CliDependencies } from '../deps/cli-dependencies';
import type {
  AudioVideoMuxer,
  MixLoudnessReport,
  MixLoudnessVerifier,
  TimelineAudioMixer,
  TimelineRenderer,
} from '../deps/timeline-renderer';

export interface FakeFileSystemFileInit {
  readonly path: string;
  readonly contents: string;
  readonly sizeBytes?: number;
  readonly modifiedAtMs?: number;
}

export interface FakeFileSystem {
  readonly readDirectory: DirectoryReader;
  readonly statFile: FileStatReader;
  readonly readTextFile: ReadTextFile;
  readonly writeTextFile: WriteTextFile;
  readonly ensureDirectory: EnsureDirectory;
  readFile(path: string): string | undefined;
  directories(): readonly string[];
}

function fileNotFoundError(path: string): Error {
  return new Error(`FakeFileSystem: no existe "${path}".`);
}

function directoryNotFoundError(path: string): Error {
  return new Error(`FakeFileSystem: no existe el directorio "${path}".`);
}

function splitDirectChild(prefix: string, path: string): string | undefined {
  if (!path.startsWith(prefix)) {
    return undefined;
  }
  const rest = path.slice(prefix.length);
  const separatorIndex = rest.indexOf('/');
  return separatorIndex === -1 ? rest : rest.slice(0, separatorIndex);
}

function ancestorDirectoriesOf(absolutePath: string): readonly string[] {
  const segments = absolutePath.split('/');
  const ancestors: string[] = [];
  let current = '';
  for (let index = 1; index < segments.length - 1; index += 1) {
    current = `${current}/${segments[index]}`;
    ancestors.push(current);
  }
  return ancestors;
}

export function createFakeFileSystem(
  files: readonly FakeFileSystemFileInit[] = [],
  directories: readonly string[] = [],
): FakeFileSystem {
  const filesByPath = new Map<string, FakeFileSystemFileInit>();
  const knownDirectories = new Set<string>(directories);

  files.forEach((file) => {
    filesByPath.set(file.path, file);
    ancestorDirectoriesOf(file.path).forEach((ancestor) => knownDirectories.add(ancestor));
  });

  const writtenFiles = new Map<string, string>();

  const readDirectory: DirectoryReader = {
    readDirectory: async (path) => {
      if (!knownDirectories.has(path)) {
        throw directoryNotFoundError(path);
      }

      const prefix = path.endsWith('/') ? path : `${path}/`;
      const childIsFile = new Map<string, boolean>();

      filesByPath.forEach((_file, filePath) => {
        const child = splitDirectChild(prefix, filePath);
        if (child === undefined || child.length === 0) {
          return;
        }
        const remainder = filePath.slice(prefix.length + child.length);
        childIsFile.set(child, childIsFile.get(child) === true || remainder.length === 0);
      });

      writtenFiles.forEach((_contents, filePath) => {
        const child = splitDirectChild(prefix, filePath);
        if (child === undefined || child.length === 0) {
          return;
        }
        const remainder = filePath.slice(prefix.length + child.length);
        childIsFile.set(child, childIsFile.get(child) === true || remainder.length === 0);
      });

      knownDirectories.forEach((directoryPath) => {
        const child = splitDirectChild(prefix, directoryPath);
        if (child === undefined || child.length === 0) {
          return;
        }
        if (!childIsFile.has(child)) {
          childIsFile.set(child, false);
        }
      });

      const entries: DirectoryEntry[] = [...childIsFile.entries()].map(([name, isFile]) => ({
        name,
        isDirectory: !isFile,
        isFile,
      }));
      return entries;
    },
  };

  const statFile: FileStatReader = {
    statFile: async (path) => {
      const written = writtenFiles.get(path);
      if (written !== undefined) {
        return { sizeBytes: written.length, modifiedAtMs: 0 };
      }
      const file = filesByPath.get(path);
      if (file === undefined) {
        throw fileNotFoundError(path);
      }
      return { sizeBytes: file.sizeBytes ?? file.contents.length, modifiedAtMs: file.modifiedAtMs ?? 0 };
    },
  };

  const writeTextFile: WriteTextFile = async (path, contents) => {
    writtenFiles.set(path, contents);
  };

  const ensureDirectory: EnsureDirectory = async (path) => {
    knownDirectories.add(path);
  };

  const readTextFile: ReadTextFile = async (path) => {
    const written = writtenFiles.get(path);
    if (written !== undefined) {
      return written;
    }
    const file = filesByPath.get(path);
    if (file !== undefined) {
      return file.contents;
    }
    throw fileNotFoundError(path);
  };

  return {
    readDirectory,
    statFile,
    readTextFile,
    writeTextFile,
    ensureDirectory,
    readFile: (path) => writtenFiles.get(path) ?? filesByPath.get(path)?.contents,
    directories: () => [...knownDirectories],
  };
}

const DEFAULT_RESOLVED_BINARIES: ResolvedBinaries = {
  ffmpeg: 'ffmpeg',
  ffprobe: 'ffprobe',
  whisperCli: 'whisper-cli',
  whisperModel: '/models/ggml-base.bin',
};

function unusedRenderTimeline(): ReturnType<TimelineRenderer> {
  return Promise.reject(new Error('fake-cli-dependencies: renderTimeline was not overridden for this test.'));
}

export const DEFAULT_FAKE_MIX_LOUDNESS: MixLoudnessReport = {
  withinTolerance: true,
  integratedLufs: -14,
  truePeakDbtp: -1.5,
  integratedDeltaLu: 0,
  truePeakDeltaDb: 0,
};

const passthroughMixer: TimelineAudioMixer = async (_timeline, request) => ({
  outputPath: request.outPath,
});

const passthroughMuxer: AudioVideoMuxer = async (request) => ({ outputPath: request.outPath });

const passthroughVerifier: MixLoudnessVerifier = async () => DEFAULT_FAKE_MIX_LOUDNESS;

export interface FakeCliDependenciesOverrides {
  readonly fileSystem?: FakeFileSystem;
  readonly runner?: CommandRunner;
  readonly resolveBinaries?: () => Promise<ResolvedBinaries>;
  readonly renderTimeline?: TimelineRenderer;
  readonly mixTimelineAudio?: TimelineAudioMixer;
  readonly muxAudioIntoVideo?: AudioVideoMuxer;
  readonly verifyMixLoudness?: MixLoudnessVerifier;
  readonly clock?: Clock;
}

export function createFakeCliDependencies(overrides: FakeCliDependenciesOverrides = {}): CliDependencies {
  const fileSystem = overrides.fileSystem ?? createFakeFileSystem();

  return {
    runner: overrides.runner ?? new FixtureCommandRunner([]),
    resolveBinaries: overrides.resolveBinaries ?? (async () => DEFAULT_RESOLVED_BINARIES),
    readDirectory: fileSystem.readDirectory,
    statFile: fileSystem.statFile,
    readTextFile: fileSystem.readTextFile,
    writeTextFile: fileSystem.writeTextFile,
    ensureDirectory: fileSystem.ensureDirectory,
    clock: overrides.clock ?? systemClock,
    renderTimeline: overrides.renderTimeline ?? unusedRenderTimeline,
    mixTimelineAudio: overrides.mixTimelineAudio ?? passthroughMixer,
    muxAudioIntoVideo: overrides.muxAudioIntoVideo ?? passthroughMuxer,
    verifyMixLoudness: overrides.verifyMixLoudness ?? passthroughVerifier,
  };
}
