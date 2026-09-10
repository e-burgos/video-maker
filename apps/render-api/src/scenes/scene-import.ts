import { mapNumberedSceneFiles } from '@video-maker/auto-montage';
import type { MediaProject, NumberedSceneMapping } from '@video-maker/auto-montage';
import type { SceneAssignment, StoryboardDocument } from '@video-maker/timeline-core';
import { SCENE_ASSIGNMENT_SCHEMA_VERSION } from '@video-maker/timeline-core';
import { join } from 'node:path/posix';

import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import { ASSET_ROLES, isAssetRole, rawDirectoryForRole } from '../store/asset-path';
import type { AssetRole } from '../store/asset-path';

export const IMPORTABLE_ASSET_ROLES: readonly AssetRole[] = ['broll', 'image', 'aroll'];

export function parseImportRoles(value: unknown): readonly AssetRole[] {
  if (value === undefined || value === null) {
    return IMPORTABLE_ASSET_ROLES;
  }

  const isRoleArray =
    Array.isArray(value) && value.length > 0 && value.every((entry) => typeof entry === 'string' && isAssetRole(entry));

  if (!isRoleArray) {
    throw new PipelineStageError({
      code: 'SCENE_IMPORT_ROLES_INVALID',
      stage: null,
      resource: 'roles',
      expected: `a non-empty array of roles among ${ASSET_ROLES.join(', ')}`,
    });
  }

  return value as readonly AssetRole[];
}

export function parseImportReplace(value: unknown): boolean {
  if (value === undefined) {
    return false;
  }
  if (typeof value !== 'boolean') {
    throw new PipelineStageError({
      code: 'SCENE_IMPORT_REPLACE_INVALID',
      stage: null,
      resource: 'replace',
      expected: 'a boolean',
    });
  }
  return value;
}

export async function collectRawAssetIds(
  deps: RenderApiDependencies,
  project: MediaProject,
  roles: readonly AssetRole[],
): Promise<readonly string[]> {
  const assetIds: string[] = [];

  for (const role of roles) {
    const relativeDirectory = join('raw', rawDirectoryForRole(role));
    const entries = await deps.storage.listDirectory(join(project.root, relativeDirectory));
    if (entries === null) {
      continue;
    }

    for (const entry of entries) {
      if (entry.isFile && !entry.name.startsWith('.')) {
        assetIds.push(join(relativeDirectory, entry.name));
      }
    }
  }

  return assetIds;
}

export function mergeNumberedMapping(
  current: SceneAssignment,
  storyboard: StoryboardDocument,
  mapping: NumberedSceneMapping,
  replace: boolean,
): SceneAssignment {
  const assignedBySceneId = new Map(
    replace ? [] : current.assignments.map((entry) => [entry.sceneId, entry.assetId] as const),
  );

  for (const match of mapping.matches) {
    assignedBySceneId.set(match.sceneId, match.assetId);
  }

  return {
    schemaVersion: SCENE_ASSIGNMENT_SCHEMA_VERSION,
    storyboardId: storyboard.id,
    assignments: storyboard.scenes
      .filter((scene) => assignedBySceneId.has(scene.id))
      .map((scene) => ({ sceneId: scene.id, assetId: assignedBySceneId.get(scene.id) ?? '' })),
  };
}

export function numberedMappingFor(
  storyboard: StoryboardDocument,
  assetIds: readonly string[],
): NumberedSceneMapping {
  return mapNumberedSceneFiles(storyboard, assetIds);
}
