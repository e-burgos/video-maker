import { serializeMontageDocument, toAbsolutePath, workPath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';
import { StoryboardDocumentSchema } from '@video-maker/timeline-core';
import type { StoryboardDocument } from '@video-maker/timeline-core';

import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import { storyboardPath } from './storyboard-paths';

const EXPECTED_DOCUMENT = 'a document accepted by StoryboardDocumentSchema';

export async function storyboardExists(
  deps: RenderApiDependencies,
  project: MediaProject,
): Promise<boolean> {
  return (await deps.storage.stat(toAbsolutePath(project, storyboardPath()))) !== null;
}

export function parseStoryboard(value: unknown, relativePath: string): StoryboardDocument {
  const result = StoryboardDocumentSchema.safeParse(value);
  if (!result.success) {
    throw new PipelineStageError({
      code: 'STORYBOARD_INVALID',
      stage: null,
      resource: relativePath,
      expected: EXPECTED_DOCUMENT,
    });
  }
  return result.data;
}

export async function readStoredStoryboard(
  deps: RenderApiDependencies,
  project: MediaProject,
): Promise<StoryboardDocument> {
  const relativePath = storyboardPath();
  const absolutePath = toAbsolutePath(project, relativePath);

  if ((await deps.storage.stat(absolutePath)) === null) {
    throw new PipelineStageError({ code: 'STORYBOARD_NOT_FOUND', stage: null, resource: relativePath });
  }

  const raw = await deps.storage.readTextFile(absolutePath);

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    throw new PipelineStageError({
      code: 'STORYBOARD_INVALID',
      stage: null,
      resource: relativePath,
      expected: EXPECTED_DOCUMENT,
    });
  }

  return parseStoryboard(parsedJson, relativePath);
}

export async function writeStoryboard(
  deps: RenderApiDependencies,
  project: MediaProject,
  document: StoryboardDocument,
): Promise<string> {
  const relativePath = storyboardPath();

  await deps.storage.ensureDirectory(toAbsolutePath(project, workPath()));
  await deps.storage.writeTextFile(
    toAbsolutePath(project, relativePath),
    serializeMontageDocument(parseStoryboard(document, relativePath)),
  );

  return relativePath;
}

export async function readStoryboardIfUsable(
  deps: RenderApiDependencies,
  project: MediaProject,
): Promise<StoryboardDocument | null> {
  try {
    return await readStoredStoryboard(deps, project);
  } catch {
    return null;
  }
}
