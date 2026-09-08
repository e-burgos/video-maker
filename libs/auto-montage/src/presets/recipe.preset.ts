import type { MontagePreset } from './montage-preset';

export const recipePreset: MontagePreset = {
  name: 'recipe',
  silence: { minSilenceMs: 300, paddingMs: 40, minKeepMs: 200 },
  punchIn: { every: 2, scales: [1.15, 1.25], anchor: 'center' },
  concepts: {
    minFrequency: 2,
    minTermLength: 4,
    dictionary: ['horno', 'sarten', 'hervir', 'receta', 'ingrediente', 'cuchillo'],
  },
  broll: {
    targetDurationMs: 2000,
    minDurationMs: 900,
    maxDurationMs: 3500,
    noRepeatWindowMs: 10_000,
    minGapMs: 500,
    maxCoverageRatio: 0.55,
    rolePriority: ['broll', 'image'],
    fit: 'cover',
  },
  captions: { maxWords: 2, maxDurationMs: 900, minDurationMs: 260, maxGapMs: 380 },
  transitions: {
    every: 2,
    durationMs: 160,
    kinds: ['light-leak', 'whip-pan'],
    timing: 'spring',
  },
  audio: { baseGainDb: -12, duckedGainDb: -20, attackMs: 100, releaseMs: 300, holdMs: 180 },
};
