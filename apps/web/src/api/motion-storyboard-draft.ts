import type { VoiceDirection } from '@video-maker/timeline-core';

import type { MotionScene, MotionStoryboard, MusicMode } from './motion-types';
import { floorTextOf, parseFloorDb } from './music-mode';
import { compactDirection, hasDirection, sameDirection } from './voice-direction';

export type SceneDirectionEdits = Readonly<Record<string, VoiceDirection | undefined>>;

export type MusicEdit = { mode: MusicMode; floorText: string };

export function storedMusicEdit(storyboard: MotionStoryboard): MusicEdit | null {
  return storyboard.music === null
    ? null
    : { mode: storyboard.music.mode ?? 'bed', floorText: floorTextOf(storyboard.music.floorDb) };
}

export function sceneDirectionOf(scene: MotionScene, edits: SceneDirectionEdits): VoiceDirection | undefined {
  return scene.id in edits ? edits[scene.id] : scene.direction;
}

export function directionsDirty(storyboard: MotionStoryboard, edits: SceneDirectionEdits): boolean {
  return storyboard.scenes.some(
    (scene) => scene.id in edits && !sameDirection(edits[scene.id], scene.direction),
  );
}

export function musicDirty(storyboard: MotionStoryboard, edit: MusicEdit | null): boolean {
  const stored = storedMusicEdit(storyboard);
  if (stored === null || edit === null) {
    return false;
  }
  if (stored.mode !== edit.mode) {
    return true;
  }
  return edit.mode === 'segments' && parseFloorDb(stored.floorText) !== parseFloorDb(edit.floorText);
}

export function musicEditValid(edit: MusicEdit | null): boolean {
  return edit === null || edit.mode === 'bed' || parseFloorDb(edit.floorText) !== null;
}

export function directedSceneCount(storyboard: MotionStoryboard, edits: SceneDirectionEdits): number {
  return storyboard.scenes.filter((scene) => hasDirection(sceneDirectionOf(scene, edits))).length;
}

function withoutKeys<T extends object>(source: T, keys: readonly string[]): T {
  return Object.fromEntries(Object.entries(source).filter(([key]) => !keys.includes(key))) as T;
}

function withoutDirection(scene: MotionScene): MotionScene {
  return withoutKeys(scene, ['direction']);
}

export function applyMotionDraft(
  storyboard: MotionStoryboard,
  edits: SceneDirectionEdits,
  musicEdit: MusicEdit | null,
): MotionStoryboard {
  const scenes = storyboard.scenes.map((scene) => {
    if (!(scene.id in edits)) {
      return scene;
    }
    const next = edits[scene.id];
    const compact = next === undefined ? undefined : compactDirection(next);
    return compact === undefined ? withoutDirection(scene) : { ...withoutDirection(scene), direction: compact };
  });

  if (storyboard.music === null || musicEdit === null) {
    return { ...storyboard, scenes };
  }

  const baseMusic = withoutKeys(storyboard.music, ['mode', 'floorDb']);
  const floorDb = parseFloorDb(musicEdit.floorText);
  return {
    ...storyboard,
    scenes,
    music:
      musicEdit.mode === 'segments' && floorDb !== null
        ? { ...baseMusic, mode: 'segments', floorDb }
        : baseMusic,
  };
}
