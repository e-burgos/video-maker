import type { StoryboardDocument, StoryboardScene, VoiceManifest } from '@video-maker/timeline-core';

import { PipelineStageError } from '../errors/pipeline-stage-error';
import { isPortableFileName } from '../store/asset-path';
import { voiceManifestPath } from './voice-paths';

export function assertSceneIdsUsableAsFileNames(document: StoryboardDocument): void {
  const unusable = document.scenes.find((scene) => !isPortableFileName(scene.id));
  if (unusable !== undefined) {
    throw new PipelineStageError({
      code: 'STORYBOARD_INVALID',
      stage: null,
      resource: unusable.id,
      expected: 'scene ids usable as file names, without separators or parent segments',
    });
  }
}

export function selectVoiceScenes(
  document: StoryboardDocument,
  sceneIds: readonly string[] | null,
): readonly StoryboardScene[] {
  assertSceneIdsUsableAsFileNames(document);

  if (sceneIds === null) {
    return document.scenes;
  }

  const byId = new Map(document.scenes.map((scene) => [scene.id, scene]));
  const missing = sceneIds.find((sceneId) => !byId.has(sceneId));
  if (missing !== undefined) {
    throw new PipelineStageError({ code: 'VOICE_SCENE_NOT_FOUND', stage: null, resource: missing });
  }

  return document.scenes.filter((scene) => sceneIds.includes(scene.id));
}

export function assertVoiceTracksNotPersisted(
  manifest: VoiceManifest | null,
  scenes: readonly StoryboardScene[],
  overwrite: boolean,
): void {
  if (overwrite || manifest === null) {
    return;
  }

  const persisted = new Set(manifest.tracks.map((track) => track.sceneId));
  const conflicting = scenes.find((scene) => persisted.has(scene.id));

  if (conflicting !== undefined) {
    throw new PipelineStageError({
      code: 'VOICE_ALREADY_EXISTS',
      stage: null,
      resource: voiceManifestPath(),
      hint: `send overwrite: true, or restrict the job with sceneIds, to replace the track of ${conflicting.id}`,
    });
  }
}
