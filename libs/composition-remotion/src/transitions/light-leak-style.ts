import type { CSSProperties } from 'react';
import type { PresentationDirection } from './whip-pan-style';

const DEFAULT_MAX_LEAK_OPACITY = 0.5;
const LEAK_TRAVEL_PERCENT = 60;

export function lightLeakSceneStyle(
  presentationDirection: PresentationDirection,
  presentationProgress: number,
): CSSProperties {
  return { opacity: presentationDirection === 'entering' ? presentationProgress : 1 };
}

export function lightLeakOpacity(presentationProgress: number, maxOpacity: number = DEFAULT_MAX_LEAK_OPACITY): number {
  return maxOpacity * Math.sin(Math.PI * presentationProgress);
}

export function lightLeakOverlayStyle(
  presentationProgress: number,
  maxOpacity: number = DEFAULT_MAX_LEAK_OPACITY,
): CSSProperties {
  const x = 20 + LEAK_TRAVEL_PERCENT * presentationProgress;
  return {
    pointerEvents: 'none',
    opacity: lightLeakOpacity(presentationProgress, maxOpacity),
    background: [
      `radial-gradient(ellipse 55% 75% at ${x}% 35%, rgba(255, 138, 48, 0.95) 0%, rgba(255, 96, 64, 0.55) 45%, rgba(255, 96, 64, 0) 75%)`,
      `radial-gradient(ellipse 40% 60% at ${100 - x}% 80%, rgba(236, 72, 120, 0.7) 0%, rgba(236, 72, 120, 0) 70%)`,
    ].join(', '),
  };
}
