import type { Timeline } from '@video-maker/timeline-core';
import { TimelineSchema } from '@video-maker/timeline-core';

import type { ProjectRelativePath } from '../catalog/catalog.schema';
import type { EnsureDirectory } from '../fs/ensure-directory';
import { guardEnsureDirectory, guardWriteTextFile } from '../fs/guard-raw-writes';
import type { WriteTextFile } from '../fs/write-text-file';
import type { MediaProject } from '../project/media-project';
import { timelinePath, toAbsolutePath, workPath } from '../project/project-paths';
import { serializeMontageDocument } from './serialize-montage-document';

export interface WriteTimelineDependencies {
  readonly writeTextFile: WriteTextFile;
  readonly ensureDirectory: EnsureDirectory;
}

export async function writeTimeline(
  project: MediaProject,
  timeline: Timeline,
  deps: WriteTimelineDependencies,
): Promise<ProjectRelativePath> {
  const parsedTimeline = TimelineSchema.parse(timeline);
  const serialized = serializeMontageDocument(parsedTimeline);

  const ensureDirectory = guardEnsureDirectory(project, deps.ensureDirectory);
  const writeTextFile = guardWriteTextFile(project, deps.writeTextFile);

  await ensureDirectory(toAbsolutePath(project, workPath()));
  const relativePath = timelinePath();
  await writeTextFile(toAbsolutePath(project, relativePath), serialized);

  return relativePath;
}
