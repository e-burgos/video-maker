import { createSeededRandom, hashStringToSeed, pickAvoidingRecent } from '@video-maker/timeline-core';

import type { MotionStoryboard, MotionStoryboardScene } from '../storyboard/motion-storyboard.schema';

export type SceneExit = NonNullable<MotionStoryboardScene['exit']>;

const SOFT_EXITS: readonly [SceneExit, ...SceneExit[]] = ['blur-up', 'scale-down', 'slide-left', 'drop'];
const CHAPTER_EXITS: readonly [SceneExit, ...SceneExit[]] = ['wipe', 'iris', 'slide-left'];
const RECENT_EXITS_TO_AVOID = 2;

function opensNewChapter(next: MotionStoryboardScene | undefined): boolean {
  return next?.chapter !== undefined;
}

export function sceneExitSeed(storyboard: MotionStoryboard): number {
  return hashStringToSeed(`${storyboard.brand}:${storyboard.title}`);
}

export function planSceneExits(storyboard: MotionStoryboard): ReadonlyMap<string, SceneExit> {
  const next = createSeededRandom(sceneExitSeed(storyboard));
  const exits = new Map<string, SceneExit>();
  const used: SceneExit[] = [];

  storyboard.scenes.slice(0, -1).forEach((scene, index) => {
    const pool = opensNewChapter(storyboard.scenes[index + 1]) ? CHAPTER_EXITS : SOFT_EXITS;
    const exit = scene.exit ?? pickAvoidingRecent(pool, used.slice(-RECENT_EXITS_TO_AVOID), next);
    exits.set(scene.id, exit);
    used.push(exit);
  });

  return exits;
}
