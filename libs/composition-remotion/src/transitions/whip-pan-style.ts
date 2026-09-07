import type { CSSProperties } from 'react';
import type { TransitionDirection } from '../helpers/timeline-types';

export type PresentationDirection = 'entering' | 'exiting';

const DEFAULT_MAX_BLUR_PX = 24;

const AXIS_BY_DIRECTION: Record<TransitionDirection, 'X' | 'Y'> = {
  'from-left': 'X',
  'from-right': 'X',
  'from-top': 'Y',
  'from-bottom': 'Y',
};

const SIGN_BY_DIRECTION: Record<TransitionDirection, 1 | -1> = {
  'from-left': 1,
  'from-right': -1,
  'from-top': 1,
  'from-bottom': -1,
};

function offsetPercent(
  direction: TransitionDirection,
  presentationDirection: PresentationDirection,
  presentationProgress: number,
): number {
  const base = presentationDirection === 'entering' ? presentationProgress - 1 : presentationProgress;
  return SIGN_BY_DIRECTION[direction] * base * 100;
}

function motionBlurPx(presentationProgress: number, maxBlurPx: number): number {
  return maxBlurPx * Math.sin(Math.PI * presentationProgress);
}

export function whipPanStyle(
  direction: TransitionDirection,
  presentationDirection: PresentationDirection,
  presentationProgress: number,
  maxBlurPx: number = DEFAULT_MAX_BLUR_PX,
): CSSProperties {
  const offset = offsetPercent(direction, presentationDirection, presentationProgress);
  const blur = motionBlurPx(presentationProgress, maxBlurPx);
  const translate = AXIS_BY_DIRECTION[direction] === 'X' ? `translateX(${offset}%)` : `translateY(${offset}%)`;

  return {
    transform: translate,
    filter: `blur(${blur}px)`,
  };
}
