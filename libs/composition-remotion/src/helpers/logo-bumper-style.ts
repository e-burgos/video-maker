import type { Fps, LogoBumperReveal } from '@video-maker/timeline-core';

export const LOGO_BUMPER_ENTER_MS = 600;
export const LOGO_BUMPER_EXIT_MS = 300;
export const LOGO_BUMPER_ZOOM_FROM = 0.8;
export const LOGO_BUMPER_SLIDE_FROM_PERCENT = 12;
export const LOGO_BUMPER_POP_FROM = 0.4;
export const LOGO_BUMPER_BLUR_FROM_PX = 24;
export const LOGO_BUMPER_BLUR_SCALE_FROM = 1.08;

const BACK_OUT_OVERSHOOT = 1.70158;

export interface LogoBumperStyleInput {
  readonly animation: LogoBumperReveal;
  readonly frame: number;
  readonly fps: Fps;
  readonly durationInFrames: number;
}

export interface LogoBumperLogoStyle {
  readonly opacity: number;
  readonly transform: string;
  readonly filter: string;
  readonly clipPath: string;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function easeOut(progress: number): number {
  return 1 - (1 - progress) ** 3;
}

function backOut(progress: number): number {
  const shifted = progress - 1;
  return 1 + (BACK_OUT_OVERSHOOT + 1) * shifted ** 3 + BACK_OUT_OVERSHOOT * shifted ** 2;
}

function msToFrameSpan(ms: number, fps: Fps): number {
  return Math.max(1, Math.round((ms / 1000) * fps));
}

export function logoBumperExitFrames(fps: Fps, durationInFrames: number): number {
  return Math.min(msToFrameSpan(LOGO_BUMPER_EXIT_MS, fps), Math.max(1, Math.floor(durationInFrames / 2)));
}

export function logoBumperEnterFrames(fps: Fps, durationInFrames: number): number {
  const available = Math.max(1, durationInFrames - logoBumperExitFrames(fps, durationInFrames));
  return Math.min(msToFrameSpan(LOGO_BUMPER_ENTER_MS, fps), available);
}

export function logoBumperEnterProgress(input: Omit<LogoBumperStyleInput, 'animation'>): number {
  return clamp01(input.frame / logoBumperEnterFrames(input.fps, input.durationInFrames));
}

function enterTransform(reveal: LogoBumperReveal, progress: number): string {
  const eased = easeOut(progress);
  switch (reveal) {
    case 'zoom':
      return `scale(${LOGO_BUMPER_ZOOM_FROM + (1 - LOGO_BUMPER_ZOOM_FROM) * eased})`;
    case 'slide-up':
      return `translateY(${LOGO_BUMPER_SLIDE_FROM_PERCENT * (1 - eased)}%)`;
    case 'pop':
      return `scale(${LOGO_BUMPER_POP_FROM + (1 - LOGO_BUMPER_POP_FROM) * backOut(progress)})`;
    case 'blur-in':
      return `scale(${LOGO_BUMPER_BLUR_SCALE_FROM - (LOGO_BUMPER_BLUR_SCALE_FROM - 1) * eased})`;
    default:
      return 'none';
  }
}

function enterOpacity(reveal: LogoBumperReveal, progress: number): number {
  return reveal === 'wipe' ? (progress > 0 ? 1 : 0) : easeOut(progress);
}

function enterFilter(reveal: LogoBumperReveal, progress: number): string {
  return reveal === 'blur-in' ? `blur(${LOGO_BUMPER_BLUR_FROM_PX * (1 - easeOut(progress))}px)` : 'none';
}

function enterClipPath(reveal: LogoBumperReveal, progress: number): string {
  return reveal === 'wipe' ? `inset(0% ${100 * (1 - easeOut(progress))}% 0% 0%)` : 'none';
}

export function logoBumperLogoStyle(input: LogoBumperStyleInput): LogoBumperLogoStyle {
  const { animation, frame, fps, durationInFrames } = input;
  const exitFrames = logoBumperExitFrames(fps, durationInFrames);
  const progress = logoBumperEnterProgress(input);
  const exited = clamp01((frame - (durationInFrames - exitFrames)) / exitFrames);

  return {
    opacity: enterOpacity(animation, progress) * (1 - exited),
    transform: enterTransform(animation, progress),
    filter: enterFilter(animation, progress),
    clipPath: enterClipPath(animation, progress),
  };
}

export function logoBumperFadeOut(frame: number, fps: Fps, durationInFrames: number): number {
  const exitFrames = logoBumperExitFrames(fps, durationInFrames);
  return 1 - clamp01((frame - (durationInFrames - exitFrames)) / exitFrames);
}
