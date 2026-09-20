import type { Fps, LogoBumperAnimation } from '@video-maker/timeline-core';

export const LOGO_BUMPER_ENTER_MS = 600;
export const LOGO_BUMPER_EXIT_MS = 300;
export const LOGO_BUMPER_ZOOM_FROM = 0.8;
export const LOGO_BUMPER_SLIDE_FROM_PERCENT = 12;

export interface LogoBumperStyleInput {
  readonly animation: LogoBumperAnimation;
  readonly frame: number;
  readonly fps: Fps;
  readonly durationInFrames: number;
}

export interface LogoBumperLogoStyle {
  readonly opacity: number;
  readonly transform: string;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function easeOut(progress: number): number {
  return 1 - (1 - progress) ** 3;
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

function enterTransform(animation: LogoBumperAnimation, eased: number): string {
  if (animation === 'zoom') {
    const scale = LOGO_BUMPER_ZOOM_FROM + (1 - LOGO_BUMPER_ZOOM_FROM) * eased;
    return `scale(${scale})`;
  }

  if (animation === 'slide-up') {
    return `translateY(${LOGO_BUMPER_SLIDE_FROM_PERCENT * (1 - eased)}%)`;
  }

  return 'none';
}

export function logoBumperLogoStyle(input: LogoBumperStyleInput): LogoBumperLogoStyle {
  const { animation, frame, fps, durationInFrames } = input;
  const enterFrames = logoBumperEnterFrames(fps, durationInFrames);
  const exitFrames = logoBumperExitFrames(fps, durationInFrames);

  const entered = easeOut(clamp01(frame / enterFrames));
  const exited = clamp01((frame - (durationInFrames - exitFrames)) / exitFrames);

  return { opacity: entered * (1 - exited), transform: enterTransform(animation, entered) };
}
