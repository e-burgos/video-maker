import type { MusicMixSettings } from '../schemas/audio-mix-plan.schema';
import type { Db, Fps, Ms } from '../types/units';
import { mergeVoiceRanges, planDuckingOverValleys } from './plan-ducking';
import type { DuckingPlanResult, VoiceRange } from './plan-ducking';

export const SEGMENTED_MUSIC_MIN_GAP_MS: Ms = 2000;
export const SEGMENTED_MUSIC_FADE_MS: Ms = 600;
export const DEFAULT_SEGMENTED_MUSIC_FLOOR_DB: Db = -30;

export type MusicMode = 'bed' | 'segments';

export interface SegmentedMusicOptions {
  floorDb?: Db;
  minGapMs?: Ms;
  fadeMs?: Ms;
}

export function segmentedMusicMix(
  base: MusicMixSettings,
  options: SegmentedMusicOptions = {},
): MusicMixSettings {
  const fadeMs = options.fadeMs ?? SEGMENTED_MUSIC_FADE_MS;
  return {
    ...base,
    mode: 'segments',
    duckedGainDb: base.baseGainDb + (options.floorDb ?? DEFAULT_SEGMENTED_MUSIC_FLOOR_DB),
    attackMs: fadeMs,
    releaseMs: fadeMs,
    holdMs: 0,
  };
}

export function planSegmentedMusic(
  voiceRanges: readonly VoiceRange[],
  mix: MusicMixSettings,
  fps: Fps,
  minGapMs: Ms = SEGMENTED_MUSIC_MIN_GAP_MS,
): DuckingPlanResult {
  return planDuckingOverValleys(mergeVoiceRanges(voiceRanges, minGapMs), mix, fps);
}
