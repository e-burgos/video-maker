import type { DirectoryReader, FileStatReader, MediaProject } from '@video-maker/auto-montage';
import { join } from 'node:path/posix';

import { StageInputMissingError } from '../errors/stage-input-missing-error';

export interface ProjectPreconditionDependencies {
  readonly readDirectory: DirectoryReader;
}

export interface StageInputDependencies {
  readonly statFile: FileStatReader;
}

const ROLE_DIRECTORY_NAMES = ['aroll', 'broll', 'images', 'audio'] as const;

async function pathIsReadable(readDirectory: DirectoryReader, path: string): Promise<boolean> {
  try {
    await readDirectory.readDirectory(path);
    return true;
  } catch {
    return false;
  }
}

async function readRawDirectoryOrThrow(readDirectory: DirectoryReader, project: MediaProject) {
  try {
    return await readDirectory.readDirectory(project.rawDir);
  } catch {
    throw new StageInputMissingError({ stage: 'ingest', resource: 'raw', reason: 'raw-missing' });
  }
}

export async function assertProjectIsIngestable(
  project: MediaProject,
  deps: ProjectPreconditionDependencies,
): Promise<void> {
  if (!(await pathIsReadable(deps.readDirectory, project.root))) {
    throw new StageInputMissingError({
      stage: 'ingest',
      resource: project.root,
      reason: 'project-root-not-found',
    });
  }

  const rawEntries = await readRawDirectoryOrThrow(deps.readDirectory, project);

  const hasRoleDirectory = rawEntries.some(
    (entry) => entry.isDirectory && (ROLE_DIRECTORY_NAMES as readonly string[]).includes(entry.name),
  );
  if (!hasRoleDirectory) {
    throw new StageInputMissingError({ stage: 'ingest', resource: 'raw', reason: 'raw-has-no-role-directory' });
  }
}

export async function assertCatalogExists(project: MediaProject, deps: StageInputDependencies): Promise<void> {
  const catalogPath = join(project.workDir, 'catalog.json');
  try {
    await deps.statFile.statFile(catalogPath);
  } catch {
    throw new StageInputMissingError({
      stage: 'plan',
      resource: 'work/catalog.json',
      reason: 'catalog-missing',
      hint: 'corré `ingest` antes de `plan`',
    });
  }
}

export async function assertTimelineExists(project: MediaProject, deps: StageInputDependencies): Promise<void> {
  const timelinePath = join(project.workDir, 'timeline.json');
  try {
    await deps.statFile.statFile(timelinePath);
  } catch {
    throw new StageInputMissingError({
      stage: 'render',
      resource: 'work/timeline.json',
      reason: 'timeline-missing',
      hint: 'corré `plan` antes de `render`',
    });
  }
}
