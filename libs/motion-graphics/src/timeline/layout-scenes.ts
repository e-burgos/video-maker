import type { MotionScene } from '../script/motion-script';

export interface SceneSlot {
  id: string;
  start: number;
  end: number;
  voStart: number;
  voDuration: number;
  vo?: string;
}

export interface LayoutOptions {
  beatSync: boolean;
  beats: number[];
  beatsPerBar?: number;
  voLeadIn?: number;
  voTail?: number;
}

export const DEFAULT_VO_LEAD_IN = 0.25;
export const DEFAULT_VO_TAIL = 0.55;

const round = (value: number): number => Math.round(value * 1000) / 1000;

function nextGridPoint(grid: number[], t: number): number {
  return grid.find((point) => point >= t - 1e-3) ?? t;
}

function nearestGridPoint(grid: number[], t: number): number {
  return grid.reduce((best, point) => (Math.abs(point - t) < Math.abs(best - t) ? point : best), grid[0] ?? t);
}

export function layoutScenes(scenes: MotionScene[], voDurations: number[], opts: LayoutOptions): SceneSlot[] {
  const leadIn = opts.voLeadIn ?? DEFAULT_VO_LEAD_IN;
  const tail = opts.voTail ?? DEFAULT_VO_TAIL;
  const beatsPerBar = opts.beatsPerBar ?? 4;
  const first = opts.beats[0] ?? 0;
  const last = opts.beats.at(-1) ?? first;
  const beatLength = opts.beats.length > 1 ? (last - first) / (opts.beats.length - 1) : 0;
  const bars = opts.beats.filter((_, index) => index % beatsPerBar === 0);
  const slots: SceneSlot[] = [];
  let cursor = 0;

  scenes.forEach((scene, index) => {
    const voDuration = voDurations[index] ?? 0;
    let start = cursor;
    if (opts.beatSync && scene.anchor !== null && bars.length > 0) {
      const anchored = nearestGridPoint(bars, scene.anchor);
      if (anchored >= cursor - 1e-3) {
        start = anchored;
        const previous = slots.at(-1);
        if (previous) previous.end = round(start);
      }
    }
    const voStart = start + leadIn;
    const voEnd = voStart + voDuration;
    const end = opts.beatSync && opts.beats.length > 0
      ? nextGridPoint(opts.beats, Math.max(start + scene.minBars * beatsPerBar * beatLength, voEnd + tail))
      : voEnd + tail;
    slots.push({ id: scene.id, start: round(start), end: round(end), voStart: round(voStart), voDuration: round(voDuration) });
    cursor = end;
  });

  return slots;
}
