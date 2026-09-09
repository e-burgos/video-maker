import type { DirectoryReader, MediaProject } from '@video-maker/auto-montage';

import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { PipelineStageError } from '../errors/pipeline-stage-error';

export { assertTimelineNotPersisted } from './project-scope';

const ROLE_DIRECTORY_NAMES = ['aroll', 'broll', 'images', 'audio'] as const;

async function pathIsReadable(readDirectory: DirectoryReader, path: string): Promise<boolean> {
  try {
    await readDirectory.readDirectory(path);
    return true;
  } catch {
    return false;
  }
}

export async function assertMontageProjectIsIngestable(
  project: MediaProject,
  deps: RenderApiDependencies,
): Promise<void> {
  if (!(await pathIsReadable(deps.readDirectory, project.root))) {
    throw new PipelineStageError({
      code: 'MONTAGE_RAW_MISSING',
      stage: null,
      resource: project.slug,
      expected: 'a project whose root directory exists and is readable',
    });
  }

  let rawEntries: Awaited<ReturnType<DirectoryReader['readDirectory']>>;
  try {
    rawEntries = await deps.readDirectory.readDirectory(project.rawDir);
  } catch {
    throw new PipelineStageError({
      code: 'MONTAGE_RAW_MISSING',
      stage: null,
      resource: 'raw',
      expected: 'a readable raw/ directory',
    });
  }

  const hasRoleDirectory = rawEntries.some(
    (entry) => entry.isDirectory && (ROLE_DIRECTORY_NAMES as readonly string[]).includes(entry.name),
  );
  if (!hasRoleDirectory) {
    throw new PipelineStageError({
      code: 'MONTAGE_RAW_MISSING',
      stage: null,
      resource: 'raw',
      expected: `raw/ containing at least one of ${ROLE_DIRECTORY_NAMES.join(', ')}`,
    });
  }
}
