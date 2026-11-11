import type { CSSProperties } from 'react';
import { noise3D } from '@remotion/noise';

export interface BumperColors {
  readonly base: string;
  readonly accent: string;
  readonly secondary: string;
}

export interface NoiseBlob {
  readonly xPercent: number;
  readonly yPercent: number;
  readonly sizePercent: number;
  readonly color: string;
}

export interface BumperShapeSpot {
  readonly kind: 'star' | 'polygon' | 'circle';
  readonly xPercent: number;
  readonly yPercent: number;
  readonly radiusRatio: number;
  readonly scale: number;
  readonly rotationDeg: number;
  readonly color: string;
}

const NOISE_BLOB_COUNT = 5;
const NOISE_SPEED = 0.012;
const NOISE_TRAVEL_PERCENT = 32;
const SHAPE_STAGGER_FRAMES = 3;
const SHAPE_GROW_FRAMES = 14;
const SHAPE_SPIN_DEG_PER_FRAME = 0.6;
const SHAPE_SPOTS: ReadonlyArray<Pick<BumperShapeSpot, 'kind' | 'xPercent' | 'yPercent' | 'radiusRatio'>> = [
  { kind: 'star', xPercent: 14, yPercent: 22, radiusRatio: 0.06 },
  { kind: 'polygon', xPercent: 86, yPercent: 18, radiusRatio: 0.08 },
  { kind: 'circle', xPercent: 90, yPercent: 78, radiusRatio: 0.05 },
  { kind: 'polygon', xPercent: 10, yPercent: 80, radiusRatio: 0.07 },
  { kind: 'star', xPercent: 72, yPercent: 88, radiusRatio: 0.04 },
  { kind: 'circle', xPercent: 28, yPercent: 10, radiusRatio: 0.035 },
];

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function hexWithAlpha(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

export function relativeLuminance(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (shift: number) => {
    const c = ((value >> shift) & 255) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
}

export function readableTextColor(base: string): string {
  return relativeLuminance(base) > 0.4 ? '#0f172a' : '#f8fafc';
}

export function gradientBackgroundStyle(colors: BumperColors, progress: number): CSSProperties {
  const angle = 115 + 40 * clamp01(progress);
  return {
    background: `linear-gradient(${angle}deg, ${colors.base} 0%, ${colors.base} 30%, ${hexWithAlpha(colors.accent, 0.35)} 72%, ${hexWithAlpha(colors.secondary, 0.5)} 100%), ${colors.base}`,
  };
}

export function glowBackgroundStyle(colors: BumperColors, progress: number): CSSProperties {
  const grown = clamp01(progress * 1.6);
  const radius = 20 + 40 * grown;
  return {
    background: `radial-gradient(circle at 50% 50%, ${hexWithAlpha(colors.accent, 0.5 * grown)} 0%, ${hexWithAlpha(colors.secondary, 0.25 * grown)} ${radius * 0.6}%, ${hexWithAlpha(colors.base, 0)} ${radius}%), ${colors.base}`,
  };
}

export function noiseBlobs(colors: BumperColors, frame: number, seed: string): NoiseBlob[] {
  return Array.from({ length: NOISE_BLOB_COUNT }, (_, index) => ({
    xPercent: 50 + NOISE_TRAVEL_PERCENT * noise3D(seed, index, 0, frame * NOISE_SPEED),
    yPercent: 50 + NOISE_TRAVEL_PERCENT * noise3D(seed, index, 10, frame * NOISE_SPEED),
    sizePercent: 38 + 14 * noise3D(seed, index, 20, frame * NOISE_SPEED),
    color: hexWithAlpha(index % 2 === 0 ? colors.accent : colors.secondary, 0.2),
  }));
}

export function bumperShapeSpots(colors: BumperColors, frame: number): BumperShapeSpot[] {
  return SHAPE_SPOTS.map((spot, index) => {
    const grown = clamp01((frame - index * SHAPE_STAGGER_FRAMES) / SHAPE_GROW_FRAMES);
    return {
      ...spot,
      scale: 1 - (1 - grown) ** 3,
      rotationDeg: (index % 2 === 0 ? 1 : -1) * SHAPE_SPIN_DEG_PER_FRAME * frame,
      color: hexWithAlpha(index % 2 === 0 ? colors.accent : colors.secondary, 0.55),
    };
  });
}

export function typedCaption(caption: string, frame: number, startFrame: number, typingFrames: number): string {
  const shown = Math.floor(caption.length * clamp01((frame - startFrame) / Math.max(1, typingFrames)));
  return caption.slice(0, shown);
}
