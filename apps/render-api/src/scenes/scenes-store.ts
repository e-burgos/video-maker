import { sceneAssignmentPath, serializeMontageDocument, toAbsolutePath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';
import { SceneAssignmentSchema, emptySceneAssignment } from '@video-maker/timeline-core';
import type { SceneAssignment, StoryboardDocument } from '@video-maker/timeline-core';

import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { PipelineStageError } from '../errors/pipeline-stage-error';

const EXPECTED_DOCUMENT = 'a document accepted by SceneAssignmentSchema';

export function parseSceneAssignment(value: unknown, relativePath: string): SceneAssignment {
  const result = SceneAssignmentSchema.safeParse(value);
  if (!result.success) {
    throw new PipelineStageError({
      code: 'SCENES_INVALID',
      stage: null,
      resource: relativePath,
      expected: EXPECTED_DOCUMENT,
    });
  }
  return result.data;
}

export async function readSceneAssignmentIfPresent(
  deps: RenderApiDependencies,
  project: MediaProject,
): Promise<SceneAssignment | null> {
  const relativePath = sceneAssignmentPath();
  const absolutePath = toAbsolutePath(project, relativePath);

  if ((await deps.storage.stat(absolutePath)) === null) {
    return null;
  }

  const raw = await deps.storage.readTextFile(absolutePath);

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    throw new PipelineStageError({
      code: 'SCENES_INVALID',
      stage: null,
      resource: relativePath,
      expected: EXPECTED_DOCUMENT,
    });
  }

  return parseSceneAssignment(parsedJson, relativePath);
}

export async function readSceneAssignmentOrEmpty(
  deps: RenderApiDependencies,
  project: MediaProject,
  storyboard: StoryboardDocument,
): Promise<SceneAssignment> {
  return (await readSceneAssignmentIfPresent(deps, project)) ?? emptySceneAssignment(storyboard.id);
}

export async function writeSceneAssignment(
  deps: RenderApiDependencies,
  project: MediaProject,
  assignment: SceneAssignment,
): Promise<string> {
  const relativePath = sceneAssignmentPath();

  await deps.storage.ensureDirectory(toAbsolutePath(project, 'work'));
  await deps.storage.writeTextFile(
    toAbsolutePath(project, relativePath),
    serializeMontageDocument(parseSceneAssignment(assignment, relativePath)),
  );

  return relativePath;
}

export function assertAssignmentMatchesStoryboard(
  assignment: SceneAssignment,
  storyboard: StoryboardDocument,
): void {
  if (assignment.storyboardId !== storyboard.id) {
    throw new PipelineStageError({
      code: 'SCENES_INVALID',
      stage: null,
      resource: 'storyboardId',
      expected: `the id of the stored storyboard (${storyboard.id})`,
    });
  }

  const sceneIds = new Set(storyboard.scenes.map((scene) => scene.id));
  for (const entry of assignment.assignments) {
    if (!sceneIds.has(entry.sceneId)) {
      throw new PipelineStageError({
        code: 'SCENE_NOT_FOUND',
        stage: null,
        resource: entry.sceneId,
        expected: 'a scene id present in the stored storyboard',
      });
    }
  }
}
