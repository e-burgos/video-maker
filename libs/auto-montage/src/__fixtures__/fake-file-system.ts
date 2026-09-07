import type { ReadTextFile } from '@video-maker/media-local';

import type { DirectoryEntry, DirectoryReader } from '../fs/directory-reader';
import type { EnsureDirectory } from '../fs/ensure-directory';
import type { FileStatReader, FileStats } from '../fs/file-stat-reader';
import type { WriteTextFile } from '../fs/write-text-file';

export interface FakeFileSystemFileInit {
  readonly path: string;
  readonly contents: string;
  readonly sizeBytes?: number;
  readonly modifiedAtMs?: number;
}

export interface FakeFileSystem {
  readonly directoryReader: DirectoryReader;
  readonly fileStatReader: FileStatReader;
  readonly writeTextFile: WriteTextFile;
  readonly ensureDirectory: EnsureDirectory;
  readonly readTextFile: ReadTextFile;
  readonly writtenFiles: ReadonlyMap<string, string>;
  readonly ensuredDirectories: readonly string[];
  readFile(path: string): string | undefined;
  statOf(path: string): FileStats | undefined;
}

function fileNotFoundError(path: string): NodeJS.ErrnoException {
  const error = new Error(`FakeFileSystem: no existe el archivo "${path}".`) as NodeJS.ErrnoException;
  error.code = 'ENOENT';
  return error;
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
  for (const file of files) {
    filesByPath.set(file.path, file);
    for (const ancestor of ancestorDirectoriesOf(file.path)) {
      knownDirectories.add(ancestor);
    }
  }

  const writtenFiles = new Map<string, string>();
  const ensuredDirectories: string[] = [];

  const directoryReader: DirectoryReader = {
    readDirectory: (path) => {
      if (!knownDirectories.has(path)) {
        return Promise.reject(new Error(`FakeFileSystem: no existe el directorio "${path}".`));
      }

      const prefix = path.endsWith('/') ? path : `${path}/`;
      const childIsFile = new Map<string, boolean>();

      for (const filePath of filesByPath.keys()) {
        const child = splitDirectChild(prefix, filePath);
        if (child === undefined || child.length === 0) {
          continue;
        }
        const remainder = filePath.slice(prefix.length + child.length);
        const isDirectFile = remainder.length === 0;
        childIsFile.set(child, childIsFile.get(child) === true || isDirectFile);
      }

      for (const directoryPath of knownDirectories) {
        const child = splitDirectChild(prefix, directoryPath);
        if (child === undefined || child.length === 0) {
          continue;
        }
        if (!childIsFile.has(child)) {
          childIsFile.set(child, false);
        }
      }

      const entries: DirectoryEntry[] = Array.from(childIsFile.entries()).map(([name, isFile]) => ({
        name,
        isDirectory: !isFile,
        isFile,
      }));
      return Promise.resolve(entries);
    },
  };

  const fileStatReader: FileStatReader = {
    statFile: (path) => {
      const file = filesByPath.get(path);
      if (file === undefined) {
        return Promise.reject(new Error(`FakeFileSystem: no existe "${path}".`));
      }
      return Promise.resolve({
        sizeBytes: file.sizeBytes ?? file.contents.length,
        modifiedAtMs: file.modifiedAtMs ?? 0,
      });
    },
  };

  const writeTextFile: WriteTextFile = (path, contents) => {
    writtenFiles.set(path, contents);
    return Promise.resolve();
  };

  const ensureDirectory: EnsureDirectory = (path) => {
    ensuredDirectories.push(path);
    return Promise.resolve();
  };

  const readTextFile: ReadTextFile = (path) => {
    const written = writtenFiles.get(path);
    if (written !== undefined) {
      return Promise.resolve(written);
    }
    const file = filesByPath.get(path);
    if (file !== undefined) {
      return Promise.resolve(file.contents);
    }
    return Promise.reject(fileNotFoundError(path));
  };

  return {
    directoryReader,
    fileStatReader,
    writeTextFile,
    ensureDirectory,
    readTextFile,
    writtenFiles,
    ensuredDirectories,
    readFile: (path) => writtenFiles.get(path) ?? filesByPath.get(path)?.contents,
    statOf: (path) => {
      const file = filesByPath.get(path);
      return file === undefined
        ? undefined
        : { sizeBytes: file.sizeBytes ?? file.contents.length, modifiedAtMs: file.modifiedAtMs ?? 0 };
    },
  };
}
