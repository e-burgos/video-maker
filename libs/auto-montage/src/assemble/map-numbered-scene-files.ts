import type { StoryboardDocument } from '@video-maker/timeline-core';

import type { ProjectRelativePath } from '../catalog/catalog.schema';

export interface NumberedSceneMatch {
  readonly sceneId: string;
  readonly sceneIndex: number;
  readonly assetId: ProjectRelativePath;
}

export type NumberedSceneSkipReason = 'no-leading-number' | 'no-scene-for-number' | 'scene-already-taken';

export interface NumberedSceneSkip {
  readonly assetId: ProjectRelativePath;
  readonly reason: NumberedSceneSkipReason;
}

export interface NumberedSceneMapping {
  readonly matches: readonly NumberedSceneMatch[];
  readonly skipped: readonly NumberedSceneSkip[];
}

const LEADING_NUMBER_PATTERN = /^(?:scene[-_]?)?(\d{1,3})(?=$|[^\d])/iu;

function fileNameOf(assetId: ProjectRelativePath): string {
  const segments = assetId.split('/');
  return segments[segments.length - 1] ?? assetId;
}

export function leadingSceneNumber(assetId: ProjectRelativePath): number | null {
  const match = LEADING_NUMBER_PATTERN.exec(fileNameOf(assetId));
  if (match === null) {
    return null;
  }
  const parsed = Number.parseInt(match[1] ?? '', 10);
  return Number.isNaN(parsed) || parsed < 1 ? null : parsed;
}

export function mapNumberedSceneFiles(
  storyboard: StoryboardDocument,
  assetIds: readonly ProjectRelativePath[],
): NumberedSceneMapping {
  const sceneByIndex = new Map(storyboard.scenes.map((scene) => [scene.index, scene] as const));
  const matches: NumberedSceneMatch[] = [];
  const skipped: NumberedSceneSkip[] = [];
  const takenSceneIds = new Set<string>();

  for (const assetId of [...assetIds].sort()) {
    const sceneNumber = leadingSceneNumber(assetId);
    if (sceneNumber === null) {
      skipped.push({ assetId, reason: 'no-leading-number' });
      continue;
    }

    const scene = sceneByIndex.get(sceneNumber);
    if (scene === undefined) {
      skipped.push({ assetId, reason: 'no-scene-for-number' });
      continue;
    }

    if (takenSceneIds.has(scene.id)) {
      skipped.push({ assetId, reason: 'scene-already-taken' });
      continue;
    }

    takenSceneIds.add(scene.id);
    matches.push({ sceneId: scene.id, sceneIndex: scene.index, assetId });
  }

  return {
    matches: matches.sort((left, right) => left.sceneIndex - right.sceneIndex),
    skipped,
  };
}
