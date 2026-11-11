import { createSeededRandom, hashStringToSeed, pickAvoidingRecent } from '@video-maker/timeline-core';

import { TITLE_STYLES } from '../storyboard/motion-storyboard.schema';
import type { MotionStoryboard, MotionStoryboardScene } from '../storyboard/motion-storyboard.schema';

export type TitleStyle = NonNullable<MotionStoryboardScene['titleStyle']>;

const RECENT_TITLE_STYLES_TO_AVOID = 2;

export function titleStyleSeed(storyboard: MotionStoryboard): number {
  return hashStringToSeed(`titles:${storyboard.brand}:${storyboard.title}`);
}

export function planTitleStyles(storyboard: MotionStoryboard): ReadonlyMap<string, TitleStyle> {
  const next = createSeededRandom(titleStyleSeed(storyboard));
  const styles = new Map<string, TitleStyle>();
  const used: TitleStyle[] = [];

  storyboard.scenes.forEach((scene) => {
    const style = scene.titleStyle ?? pickAvoidingRecent(TITLE_STYLES, used.slice(-RECENT_TITLE_STYLES_TO_AVOID), next);
    styles.set(scene.id, style);
    used.push(style);
  });

  return styles;
}
