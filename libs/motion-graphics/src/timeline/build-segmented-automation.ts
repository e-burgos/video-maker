import type { VolumeAutomation } from './build-duck-automation';
import type { SceneSlot } from './layout-scenes';
import { normalizeAutomationPoints } from './normalize-automation-points';
import type { AutomationPoint } from './normalize-automation-points';

export const SEGMENTED_MUSIC_MIN_GAP_SEC = 2;
export const SEGMENTED_MUSIC_FADE_SEC = 0.6;
export const DEFAULT_SEGMENTED_MUSIC_FLOOR_DB = -30;

export interface SegmentedOptions {
  bedLevel: number;
  floorDb?: number;
  minGap?: number;
  fade?: number;
  fadeOut?: number;
}

interface VoiceWindow {
  start: number;
  end: number;
}

const DEFAULT_FADE_OUT = 2.5;

export function floorLevelFor(bedLevel: number, floorDb: number): number {
  return Math.round(bedLevel * 10 ** (floorDb / 20) * 10_000) / 10_000;
}

function mergeCloseWindows(slots: readonly SceneSlot[], minGap: number): VoiceWindow[] {
  const merged: VoiceWindow[] = [];
  for (const slot of slots) {
    const window = { start: slot.voStart, end: slot.voStart + slot.voDuration };
    const last = merged.at(-1);
    if (last !== undefined && window.start - last.end < minGap) {
      last.end = Math.max(last.end, window.end);
    } else {
      merged.push(window);
    }
  }
  return merged;
}

function windowRamps(windows: readonly VoiceWindow[], fade: number, floor: number, bed: number): AutomationPoint[] {
  const points: AutomationPoint[] = [];
  windows.forEach((window, index) => {
    if (index > 0) points.push({ t: window.start - fade, v: bed });
    points.push({ t: window.start, v: floor }, { t: window.end, v: floor });
    if (index < windows.length - 1) points.push({ t: window.end + fade, v: bed });
  });
  return points;
}

export function buildSegmentedAutomation(slots: readonly SceneSlot[], duration: number, opts: SegmentedOptions): VolumeAutomation {
  const fade = opts.fade ?? SEGMENTED_MUSIC_FADE_SEC;
  const fadeOut = opts.fadeOut ?? DEFAULT_FADE_OUT;
  const bed = opts.bedLevel;
  const floor = floorLevelFor(bed, opts.floorDb ?? DEFAULT_SEGMENTED_MUSIC_FLOOR_DB);
  const windows = mergeCloseWindows(slots, opts.minGap ?? SEGMENTED_MUSIC_MIN_GAP_SEC);
  const first = windows[0];
  const last = windows.at(-1);
  if (first === undefined || last === undefined) {
    return buildBedOnly(duration, bed, fade, fadeOut);
  }

  const introHasRoom = first.start - fade > fade;
  const outroHasRoom = last.end + fade < duration - fadeOut;
  const raw: AutomationPoint[] = [
    { t: 0, v: 0 },
    ...(introHasRoom ? [{ t: fade, v: bed }, { t: first.start - fade, v: bed }] : []),
    ...windowRamps(windows, fade, floor, bed),
    ...(outroHasRoom ? [{ t: last.end + fade, v: bed }, { t: duration - fadeOut, v: bed }] : []),
    { t: duration, v: 0 },
  ];

  return { version: 1, lanes: [{ target: 'volume', points: normalizeAutomationPoints(raw) }] };
}

function buildBedOnly(duration: number, bed: number, fade: number, fadeOut: number): VolumeAutomation {
  const raw: AutomationPoint[] = [{ t: 0, v: 0 }, { t: fade, v: bed }, { t: duration - fadeOut, v: bed }, { t: duration, v: 0 }];
  return { version: 1, lanes: [{ target: 'volume', points: normalizeAutomationPoints(raw) }] };
}
