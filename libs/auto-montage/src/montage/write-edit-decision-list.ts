import type { EditDecisionList } from '@video-maker/timeline-core';
import { EditDecisionListSchema } from '@video-maker/timeline-core';

import type { ProjectRelativePath } from '../catalog/catalog.schema';
import type { EnsureDirectory } from '../fs/ensure-directory';
import { guardEnsureDirectory, guardWriteTextFile } from '../fs/guard-raw-writes';
import type { WriteTextFile } from '../fs/write-text-file';
import type { MediaProject } from '../project/media-project';
import { editDecisionListPath, toAbsolutePath, workPath } from '../project/project-paths';
import { serializeMontageDocument } from './serialize-montage-document';

export interface WriteEditDecisionListDependencies {
  readonly writeTextFile: WriteTextFile;
  readonly ensureDirectory: EnsureDirectory;
}

export async function writeEditDecisionList(
  project: MediaProject,
  edl: EditDecisionList,
  deps: WriteEditDecisionListDependencies,
): Promise<ProjectRelativePath> {
  const parsedEdl = EditDecisionListSchema.parse(edl);
  const serialized = serializeMontageDocument(parsedEdl);

  const ensureDirectory = guardEnsureDirectory(project, deps.ensureDirectory);
  const writeTextFile = guardWriteTextFile(project, deps.writeTextFile);

  await ensureDirectory(toAbsolutePath(project, workPath()));
  const relativePath = editDecisionListPath();
  await writeTextFile(toAbsolutePath(project, relativePath), serialized);

  return relativePath;
}
