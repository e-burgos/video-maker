import { Easing, interpolate, spring } from 'remotion';

export const TEXT_OVERLAY_DURATION = { fast: 10, base: 18, slow: 24 } as const;
export const TEXT_OVERLAY_STAGGER = 4;
export const TEXT_OVERLAY_EXIT_FRAMES = 10;

const SPRING_SMOOTH = { damping: 200, stiffness: 100, mass: 1 } as const;
const SPRING_SNAPPY = { damping: 12, stiffness: 180, mass: 0.6 } as const;
const HOUSE_EASE = Easing.bezier(0.16, 1, 0.3, 1);
const PLATE_EASE = Easing.inOut(Easing.cubic);
const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export interface MotionInput {
  readonly frame: number;
  readonly fps: number;
  readonly delay?: number;
  readonly durationInFrames?: number;
}

export interface MotionStyle {
  readonly opacity: number;
  readonly transform: string;
  readonly filter: string;
}

export type SlideDirection = 'left' | 'right' | 'up' | 'down';

function smoothProgress({ frame, fps, delay = 0, durationInFrames = TEXT_OVERLAY_DURATION.base }: MotionInput): number {
  return spring({ frame: Math.max(0, frame - delay), fps, config: SPRING_SMOOTH, durationInFrames });
}

function unit(progress: number): number {
  return interpolate(progress, [0, 1], [0, 1], CLAMP);
}

export function easedProgress({ frame, delay = 0, durationInFrames = TEXT_OVERLAY_DURATION.base }: Omit<MotionInput, 'fps'>): number {
  return interpolate(frame - delay, [0, durationInFrames], [0, 1], { ...CLAMP, easing: HOUSE_EASE });
}

export function entryFade(input: MotionInput): MotionStyle {
  return { opacity: unit(smoothProgress(input)), transform: 'none', filter: 'none' };
}

export function entrySlide(input: MotionInput & { direction: SlideDirection; distance: number }): MotionStyle {
  const progress = smoothProgress(input);
  const sign = input.direction === 'left' || input.direction === 'up' ? -1 : 1;
  const offset = interpolate(progress, [0, 1], [sign * input.distance, 0], CLAMP);
  const vertical = input.direction === 'up' || input.direction === 'down';
  return {
    opacity: unit(progress),
    transform: vertical ? `translateY(${offset}px)` : `translateX(${offset}px)`,
    filter: 'none',
  };
}

export function entryFadeRise(input: MotionInput & { travelPx: number }): MotionStyle {
  const progress = smoothProgress(input);
  return {
    opacity: unit(progress),
    transform: `translateY(${interpolate(progress, [0, 1], [input.travelPx, 0], CLAMP)}px)`,
    filter: 'none',
  };
}

export function blurReveal(input: MotionInput & { travelPx: number; blurPx: number }): MotionStyle {
  const progress = smoothProgress(input);
  return {
    opacity: unit(progress),
    transform: `translateY(${interpolate(progress, [0, 1], [input.travelPx, 0], CLAMP)}px)`,
    filter: `blur(${interpolate(progress, [0, 1], [input.blurPx, 0], CLAMP)}px)`,
  };
}

export function entryPop(input: MotionInput & { from: number }): MotionStyle {
  const progress = spring({
    frame: Math.max(0, input.frame - (input.delay ?? 0)),
    fps: input.fps,
    config: SPRING_SNAPPY,
  });
  return {
    opacity: unit(Math.min(1, progress * 2)),
    transform: `scale(${input.from + (1 - input.from) * progress})`,
    filter: 'none',
  };
}

export function lineGrowth(input: MotionInput): number {
  return interpolate(smoothProgress(input), [0, 1], [0, 100], CLAMP);
}

export function exitFade(frame: number, durationInFrames: number): number {
  const exitStart = durationInFrames - TEXT_OVERLAY_EXIT_FRAMES;
  return 1 - easedProgress({ frame, delay: exitStart, durationInFrames: TEXT_OVERLAY_EXIT_FRAMES });
}

export const PLATE_REVEAL_FRAMES = 12;

export function plateReveal(frame: number, align: 'left' | 'right' | 'center', durationInFrames: number = PLATE_REVEAL_FRAMES): string {
  const hidden = 100 * (1 - interpolate(frame, [0, durationInFrames], [0, 1], { ...CLAMP, easing: PLATE_EASE }));
  if (align === 'right') {
    return `inset(0% 0% 0% ${hidden}%)`;
  }
  if (align === 'center') {
    return `inset(0% ${hidden / 2}% 0% ${hidden / 2}%)`;
  }
  return `inset(0% ${hidden}% 0% 0%)`;
}

export function staggerDelay(index: number, increment: number = TEXT_OVERLAY_STAGGER): number {
  return Math.max(0, index) * increment;
}

export function splitWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}
