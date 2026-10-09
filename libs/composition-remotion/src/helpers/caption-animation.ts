import type { CSSProperties } from 'react';
import { interpolate, spring } from 'remotion';
import type { CaptionPreset } from './caption-preset';

export type CaptionAnimationMode = 'pop' | 'rise' | 'fade';

export interface CaptionSpring {
  damping: number;
  mass: number;
  stiffness: number;
}

export type CaptionAnimation =
  | { mode: 'pop'; spring: CaptionSpring; enterDurationFrames: number; enterScale: number }
  | { mode: 'rise'; spring: CaptionSpring; enterDurationFrames: number; riseDistanceEm: number }
  | { mode: 'fade'; spring: CaptionSpring; enterDurationFrames: number };

export interface CaptionClipAnimationInput {
  frame: number;
  durationInFrames: number;
  fps: number;
  preset: CaptionPreset;
}

export interface CaptionClipAnimation {
  opacity: number;
  scale: number;
  translateYEm: number;
  transform: string;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function enterFramesFor(preferredFrames: number, durationInFrames: number): number {
  return Math.max(1, Math.min(preferredFrames, Math.floor(durationInFrames / 2)));
}

export function captionClipAnimation(input: CaptionClipAnimationInput): CaptionClipAnimation {
  const { frame, durationInFrames, fps, preset } = input;
  const { animation } = preset;
  const enterFrames = enterFramesFor(animation.enterDurationFrames, durationInFrames);
  const framesFromEnd = durationInFrames - 1 - frame;

  const enter = spring({
    frame,
    fps,
    config: animation.spring,
    durationInFrames: enterFrames,
  });
  const exit = spring({
    frame: framesFromEnd,
    fps,
    config: animation.spring,
    durationInFrames: enterFrames,
  });
  const progress = enter + exit - 1;

  const opacity = round3(
    interpolate(progress, [0, 1], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  );
  const scale = round3(
    animation.mode === 'pop' ? interpolate(progress, [0, 1], [animation.enterScale, 1]) : 1,
  );
  const translateYEm = round3(
    animation.mode === 'rise' ? interpolate(progress, [0, 1], [animation.riseDistanceEm, 0]) : 0,
  );
  const transform = `translateY(${translateYEm}em) scale(${scale})`;

  return { opacity, scale, translateYEm, transform };
}

export function captionBlockStyle(
  animation: CaptionClipAnimation,
  preset: CaptionPreset,
): CSSProperties {
  return {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: `${preset.wordGapEm}em`,
    maxWidth: '100%',
    opacity: animation.opacity,
    transform: animation.transform,
    transformOrigin: '50% 50%',
    ...(preset.backdrop === null
      ? {}
      : {
          boxSizing: 'border-box',
          backgroundColor: preset.backdrop.color,
          padding: `${preset.backdrop.paddingYEm}em ${preset.backdrop.paddingXEm}em`,
          borderRadius: `${preset.backdrop.radiusEm}em`,
        }),
  };
}
