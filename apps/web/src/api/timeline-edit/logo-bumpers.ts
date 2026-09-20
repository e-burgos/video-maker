import {
  DEFAULT_LOGO_BUMPER_BACKGROUND_COLOR,
  DEFAULT_LOGO_BUMPER_DURATION_MS,
  DEFAULT_LOGO_BUMPER_WIDTH_RATIO,
  LOGO_BUMPER_ANIMATIONS,
} from '@video-maker/timeline-core';
import type { LogoBumper, LogoBumperAnimation, Timeline } from '@video-maker/timeline-core';

export const BUMPER_EDGES = ['intro', 'outro'] as const;

export type BumperEdge = (typeof BUMPER_EDGES)[number];

export type BumperStyle = Partial<Omit<LogoBumper, 'enabled'>>;

export const BUMPER_ANIMATIONS: readonly LogoBumperAnimation[] = LOGO_BUMPER_ANIMATIONS;

export const BUMPER_DURATIONS_MS = [1500, 2000, 3000, 4000] as const;

export const BUMPER_LOGO_SIZES = ['small', 'medium', 'large'] as const;

export type BumperLogoSize = (typeof BUMPER_LOGO_SIZES)[number];

export const BUMPER_LOGO_WIDTH_RATIO_BY_SIZE: Readonly<Record<BumperLogoSize, number>> = {
  small: 0.3,
  medium: DEFAULT_LOGO_BUMPER_WIDTH_RATIO,
  large: 0.55,
};

export const DEFAULT_LOGO_BUMPER: LogoBumper = {
  enabled: true,
  durationMs: DEFAULT_LOGO_BUMPER_DURATION_MS,
  backgroundColor: DEFAULT_LOGO_BUMPER_BACKGROUND_COLOR,
  animation: 'zoom',
  logoWidthRatio: DEFAULT_LOGO_BUMPER_WIDTH_RATIO,
};

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/u;

export function isBumperColor(value: string): boolean {
  return HEX_COLOR.test(value);
}

export function bumperLogoSizeOf(logoWidthRatio: number): BumperLogoSize {
  return BUMPER_LOGO_SIZES.reduce((closest, size) =>
    Math.abs(BUMPER_LOGO_WIDTH_RATIO_BY_SIZE[size] - logoWidthRatio) <
    Math.abs(BUMPER_LOGO_WIDTH_RATIO_BY_SIZE[closest] - logoWidthRatio)
      ? size
      : closest,
  );
}

export function bumperOf(timeline: Timeline, edge: BumperEdge): LogoBumper | undefined {
  return timeline.bumpers?.[edge];
}

function withBumper(timeline: Timeline, edge: BumperEdge, bumper: LogoBumper): Timeline {
  return { ...timeline, bumpers: { ...timeline.bumpers, [edge]: bumper } };
}

export function setTimelineBumperEnabled(
  timeline: Timeline,
  edge: BumperEdge,
  enabled: boolean,
): Timeline {
  if (timeline.logo === undefined && enabled) {
    return timeline;
  }

  const current = bumperOf(timeline, edge) ?? DEFAULT_LOGO_BUMPER;
  return withBumper(timeline, edge, { ...current, enabled });
}

export function setTimelineBumperStyle(
  timeline: Timeline,
  edge: BumperEdge,
  style: BumperStyle,
): Timeline {
  const current = bumperOf(timeline, edge);
  if (current === undefined) {
    return timeline;
  }

  return withBumper(timeline, edge, { ...current, ...style });
}

export function bumperSeconds(timeline: Timeline, edge: BumperEdge): number | null {
  const bumper = bumperOf(timeline, edge);
  return bumper === undefined || !bumper.enabled ? null : bumper.durationMs / 1000;
}
