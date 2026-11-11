import { introBumperFrames } from './bumper-frames';
import { resolveBumperLook } from './resolve-bumper-look';
import type { BumperEdge, BumperLook } from './resolve-bumper-look';
import type { LogoBumperSfxKind, Timeline } from '../schemas/timeline.schema';
import type { Fps } from '../types/units';
import { framesToMs } from '../units/units';

export const BUMPER_REVEAL_ENTER_MS = 600;
export const MAX_BUMPER_CAPTION_CLICKS = 3;

export interface BumperSfxAutoCue {
  readonly source: 'auto';
  readonly edge: BumperEdge;
  readonly kind: LogoBumperSfxKind;
  readonly atMs: number;
  readonly gainDb: number;
  readonly fadeOutMs: number;
}

export interface BumperSfxAssetCue {
  readonly source: 'cue';
  readonly edge: BumperEdge;
  readonly assetId: string;
  readonly atMs: number;
  readonly gainDb: number;
  readonly fadeInMs?: number;
  readonly fadeOutMs?: number;
}

export type BumperSfxPlanItem = BumperSfxAutoCue | BumperSfxAssetCue;

const REVEAL_CUE: Readonly<Record<Exclude<LogoBumperSfxKind, 'click'>, { atMs: number; gainDb: number; fadeOutMs: number }>> = {
  whoosh: { atMs: 0, gainDb: -14, fadeOutMs: 200 },
  impact: { atMs: 330, gainDb: -12, fadeOutMs: 250 },
  shimmer: { atMs: 120, gainDb: -16, fadeOutMs: 400 },
};
const CLICK_CUE = { gainDb: -24, fadeOutMs: 60 };

function revealCue(edge: BumperEdge, kind: LogoBumperSfxKind, offsetMs: number): BumperSfxAutoCue[] {
  if (kind === 'click') {
    return [{ source: 'auto', edge, kind, atMs: offsetMs, ...CLICK_CUE }];
  }
  const cue = REVEAL_CUE[kind];
  return [{ source: 'auto', edge, kind, atMs: offsetMs + cue.atMs, gainDb: cue.gainDb, fadeOutMs: cue.fadeOutMs }];
}

function captionClicks(edge: BumperEdge, look: BumperLook, offsetMs: number, fps: Fps): BumperSfxAutoCue[] {
  if (look.caption === null) {
    return [];
  }
  const typingMs = framesToMs(look.caption.length, fps);
  const clicks = Math.min(MAX_BUMPER_CAPTION_CLICKS, look.caption.length);
  return Array.from({ length: clicks }, (_, index) => ({
    source: 'auto' as const,
    edge,
    kind: 'click' as const,
    atMs: Math.round(offsetMs + BUMPER_REVEAL_ENTER_MS + (typingMs * index) / clicks),
    ...CLICK_CUE,
  }));
}

function edgeOffsetMs(timeline: Timeline, edge: BumperEdge): number {
  return edge === 'intro'
    ? 0
    : framesToMs(introBumperFrames(timeline) + timeline.durationFrames, timeline.format.fps);
}

function planEdge(timeline: Timeline, edge: BumperEdge): BumperSfxPlanItem[] {
  const bumpers = timeline.bumpers;
  const bumper = bumpers?.[edge];
  if (bumpers === undefined || bumper === undefined || !bumper.enabled) {
    return [];
  }
  const offsetMs = edgeOffsetMs(timeline, edge);
  if (bumper.sfx !== undefined) {
    return bumper.sfx.map((cue) => ({
      source: 'cue' as const,
      edge,
      assetId: cue.assetId,
      atMs: offsetMs + cue.atMs,
      gainDb: cue.gainDb,
      ...(cue.fadeInMs === undefined ? {} : { fadeInMs: cue.fadeInMs }),
      ...(cue.fadeOutMs === undefined ? {} : { fadeOutMs: cue.fadeOutMs }),
    }));
  }
  const look = resolveBumperLook(bumpers, edge, timeline.id);
  if (look === null || look.sfxKind === null) {
    return [];
  }
  return [...revealCue(edge, look.sfxKind, offsetMs), ...captionClicks(edge, look, offsetMs, timeline.format.fps)];
}

export function planBumperSfx(timeline: Timeline): readonly BumperSfxPlanItem[] {
  return [...planEdge(timeline, 'intro'), ...planEdge(timeline, 'outro')];
}
