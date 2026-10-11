import type { SecondsRange, VoiceSegmentLevels } from './review-inputs';
import type { ReviewMeasurements } from './review-measurements';

export interface SourceSlice {
  readonly path: string;
  readonly startSec: number;
  readonly endSec: number;
}

export interface LevelPlan extends SecondsRange {
  readonly voice: SourceSlice | null;
  readonly voiceNormalization: { readonly whole: SourceSlice; readonly targetLufs: number } | null;
  readonly music: SourceSlice | null;
  readonly musicGainDb: number;
}

async function measureSlice(
  slice: SourceSlice | null,
  measurements: ReviewMeasurements,
  cache: Map<string, Promise<number | null>>,
): Promise<number | null> {
  if (slice === null) {
    return null;
  }
  const key = `${slice.path}|${String(slice.startSec)}|${String(slice.endSec)}`;
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const pending = measurements
    .measureSegments(slice.path, [{ startSec: slice.startSec, endSec: slice.endSec }])
    .then((levels) => levels[0] ?? null);
  cache.set(key, pending);
  return pending;
}

async function voiceLufsFor(
  plan: LevelPlan,
  measurements: ReviewMeasurements,
  cache: Map<string, Promise<number | null>>,
): Promise<number | null> {
  const raw = await measureSlice(plan.voice, measurements, cache);
  if (raw === null || plan.voiceNormalization === null) {
    return raw;
  }
  const whole = await measureSlice(plan.voiceNormalization.whole, measurements, cache);
  return whole === null ? null : plan.voiceNormalization.targetLufs + (raw - whole);
}

export async function measureLevelPlans(
  plans: readonly LevelPlan[],
  measurements: ReviewMeasurements,
  bumperOffsetSec: number,
): Promise<VoiceSegmentLevels[]> {
  const cache = new Map<string, Promise<number | null>>();
  const levels: VoiceSegmentLevels[] = [];
  for (const plan of plans) {
    levels.push({
      startSec: plan.startSec + bumperOffsetSec,
      endSec: plan.endSec + bumperOffsetSec,
      voiceLufs: await voiceLufsFor(plan, measurements, cache),
      musicLufs: await measureSlice(plan.music, measurements, cache),
      musicGainDb: plan.musicGainDb,
    });
  }
  return levels;
}
