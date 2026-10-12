import { normalizeAutomationPoints } from './normalize-automation-points';
import type { AutomationPoint } from './normalize-automation-points';
import type { SceneSlot } from './layout-scenes';

export type { AutomationPoint } from './normalize-automation-points';

export interface VolumeAutomation {
  version: 1;
  lanes: [{ target: 'volume'; points: AutomationPoint[] }];
}

export interface DuckOptions {
  bedLevel?: number;
  duckLevel?: number;
  ramp?: number;
  fadeIn?: number;
  fadeOut?: number;
}

export function buildDuckAutomation(slots: SceneSlot[], duration: number, opts: DuckOptions = {}): VolumeAutomation {
  const bed = opts.bedLevel ?? 0.85;
  const duck = opts.duckLevel ?? 0.32;
  const ramp = opts.ramp ?? 0.25;
  const fadeIn = opts.fadeIn ?? 0.6;
  const fadeOut = opts.fadeOut ?? 2.5;
  const raw: AutomationPoint[] = [{ t: 0, v: 0 }, { t: fadeIn, v: bed }];
  for (const slot of slots) {
    const release = slot.voStart + slot.voDuration + 0.1;
    raw.push(
      { t: slot.voStart - ramp, v: bed },
      { t: slot.voStart, v: duck },
      { t: release, v: duck },
      { t: release + ramp, v: bed },
    );
  }
  raw.push({ t: duration - fadeOut, v: bed }, { t: duration, v: 0 });
  return { version: 1, lanes: [{ target: 'volume', points: normalizeAutomationPoints(raw) }] };
}
