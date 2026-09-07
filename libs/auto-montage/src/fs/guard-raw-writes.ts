import { ReadOnlyRawPathError } from '../errors/read-only-raw-path-error';
import type { MediaProject } from '../project/media-project';
import { isInsideRaw, toProjectRelativePath } from '../project/project-paths';
import type { EnsureDirectory } from './ensure-directory';
import type { WriteTextFile } from './write-text-file';

export function assertWritableProjectPath(project: MediaProject, absolutePath: string): void {
  const relativePath = toProjectRelativePath(project, absolutePath);
  if (isInsideRaw(relativePath)) {
    throw new ReadOnlyRawPathError({ projectRoot: project.root, attemptedPath: relativePath });
  }
}

export function guardWriteTextFile(project: MediaProject, write: WriteTextFile): WriteTextFile {
  return async (path, contents) => {
    assertWritableProjectPath(project, path);
    await write(path, contents);
  };
}

export function guardEnsureDirectory(project: MediaProject, ensure: EnsureDirectory): EnsureDirectory {
  return async (path) => {
    assertWritableProjectPath(project, path);
    await ensure(path);
  };
}
