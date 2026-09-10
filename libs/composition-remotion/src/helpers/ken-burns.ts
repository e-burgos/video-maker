import type { SceneKenBurns } from '@video-maker/timeline-core';

export interface KenBurnsInput {
  frame: number;
  durationInFrames: number;
  move: SceneKenBurns;
}

export interface KenBurnsTransform {
  scale: number;
  translateXPercent: number;
  translateYPercent: number;
}

export const DEFAULT_IMAGE_KEN_BURNS: SceneKenBurns = { zoomFrom: 1, zoomTo: 1.12 };

const PAN_PERCENT_PER_ZOOM_UNIT = 24;

export function kenBurnsProgress(frame: number, durationInFrames: number): number {
  if (durationInFrames <= 1) {
    return 0;
  }
  const clampedFrame = Math.min(Math.max(frame, 0), durationInFrames - 1);
  return clampedFrame / (durationInFrames - 1);
}

export function kenBurnsTransform({ frame, durationInFrames, move }: KenBurnsInput): KenBurnsTransform {
  const progress = kenBurnsProgress(frame, durationInFrames);
  const scale = move.zoomFrom + (move.zoomTo - move.zoomFrom) * progress;
  const pan = (scale - 1) * PAN_PERCENT_PER_ZOOM_UNIT;

  return {
    scale,
    translateXPercent: -pan * progress + 0,
    translateYPercent: pan * progress * 0.5 + 0,
  };
}

export function kenBurnsCss(transform: KenBurnsTransform): string {
  return `scale(${transform.scale}) translate(${transform.translateXPercent}%, ${transform.translateYPercent}%)`;
}
