import { DEFAULT_MUSIC_REFERENCE_LUFS } from '../audio/music-normalization';
import type { AudioMixPlan, GainKeyframe, MusicMixSettings } from '../schemas/audio-mix-plan.schema';
import { sequentialId } from '../timeline/ids';
import type { DecisionId, Db, Fps, Ms } from '../types/units';
import { msToFrames } from '../units/units';

export interface VoiceRange {
  startMs: Ms;
  endMs: Ms;
}

export interface DuckDecisionPlan {
  id: DecisionId;
  startMs: Ms;
  endMs: Ms;
  gainDb: Db;
}

export interface DuckingPlanResult {
  automation: GainKeyframe[];
  decisions: DuckDecisionPlan[];
}

const DUCK_DECISION_PREFIX = 'duck';

export const DEFAULT_MUSIC_MIX: MusicMixSettings = {
  baseGainDb: -12,
  duckedGainDb: -24,
  referenceLufs: DEFAULT_MUSIC_REFERENCE_LUFS,
  attackMs: 150,
  releaseMs: 400,
  holdMs: 250,
};

export const DEFAULT_AUDIO_MIX_PLAN: AudioMixPlan = {
  voice: { integratedLufs: -14, truePeakDbtp: -1, loudnessRange: 11 },
  music: DEFAULT_MUSIC_MIX,
  automation: [],
};

export function mergeVoiceRanges(ranges: readonly VoiceRange[], holdMs: Ms): VoiceRange[] {
  const sortedRanges = ranges
    .filter((range) => range.endMs > range.startMs)
    .slice()
    .sort((a, b) => a.startMs - b.startMs);

  const valleys: VoiceRange[] = [];
  for (const range of sortedRanges) {
    const lastValley = valleys[valleys.length - 1];
    if (lastValley !== undefined && range.startMs - lastValley.endMs < holdMs) {
      lastValley.endMs = Math.max(lastValley.endMs, range.endMs);
    } else {
      valleys.push({ ...range });
    }
  }
  return valleys;
}

function dedupeKeyframesByFrame(keyframes: readonly GainKeyframe[]): GainKeyframe[] {
  const gainByFrame = new Map<number, Db>();
  for (const keyframe of keyframes) {
    gainByFrame.set(keyframe.frame, keyframe.gainDb);
  }
  return Array.from(gainByFrame, ([frame, gainDb]) => ({ frame, gainDb }));
}

function resolveReleaseTail(
  releaseStartMs: Ms,
  nextAttackStartMs: Ms,
  settings: MusicMixSettings,
): { clampedEndMs: Ms; endGainDb: Db } {
  if (settings.releaseMs <= 0) {
    return { clampedEndMs: releaseStartMs, endGainDb: settings.baseGainDb };
  }

  const releaseEndMs = releaseStartMs + settings.releaseMs;
  const clampedEndMs = Math.min(releaseEndMs, nextAttackStartMs);
  const endGainDb =
    settings.duckedGainDb +
    (settings.baseGainDb - settings.duckedGainDb) * ((clampedEndMs - releaseStartMs) / settings.releaseMs);

  return { clampedEndMs, endGainDb };
}

function pushValleyKeyframes(
  keyframes: GainKeyframe[],
  valley: VoiceRange,
  isFirstValley: boolean,
  nextAttackStartMs: Ms,
  settings: MusicMixSettings,
  fps: Fps,
): void {
  const { baseGainDb, duckedGainDb, attackMs, holdMs } = settings;
  const attackStartMs = Math.max(0, valley.startMs - attackMs);
  const releaseStartMs = valley.endMs + holdMs;
  const { clampedEndMs, endGainDb } = resolveReleaseTail(releaseStartMs, nextAttackStartMs, settings);

  if (isFirstValley && attackStartMs > 0) {
    keyframes.push({ frame: 0, gainDb: baseGainDb });
  }
  keyframes.push({ frame: msToFrames(attackStartMs, fps), gainDb: baseGainDb });
  keyframes.push({ frame: msToFrames(valley.startMs, fps), gainDb: duckedGainDb });
  keyframes.push({ frame: msToFrames(releaseStartMs, fps), gainDb: duckedGainDb });
  keyframes.push({ frame: msToFrames(clampedEndMs, fps), gainDb: endGainDb });
}

export function planDucking(
  voiceRanges: readonly VoiceRange[],
  plan: MusicMixSettings,
  fps: Fps,
): DuckingPlanResult {
  return planDuckingOverValleys(mergeVoiceRanges(voiceRanges, plan.holdMs), plan, fps);
}

export function planDuckingOverValleys(
  valleys: readonly VoiceRange[],
  plan: MusicMixSettings,
  fps: Fps,
): DuckingPlanResult {
  if (valleys.length === 0) {
    return { automation: [], decisions: [] };
  }

  const rawKeyframes: GainKeyframe[] = [];
  valleys.forEach((valley, index) => {
    const nextValley = valleys[index + 1];
    const nextAttackStartMs =
      nextValley === undefined ? Infinity : Math.max(0, nextValley.startMs - plan.attackMs);
    pushValleyKeyframes(rawKeyframes, valley, index === 0, nextAttackStartMs, plan, fps);
  });

  const decisions = valleys.map((valley, index) => ({
    id: sequentialId(DUCK_DECISION_PREFIX, index),
    startMs: valley.startMs,
    endMs: valley.endMs,
    gainDb: plan.duckedGainDb,
  }));

  return { automation: dedupeKeyframesByFrame(rawKeyframes), decisions };
}
