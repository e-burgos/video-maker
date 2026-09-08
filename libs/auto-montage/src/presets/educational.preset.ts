import type { MontagePreset } from './montage-preset';

export const educationalPreset: MontagePreset = {
  name: 'educational',
  silence: { minSilenceMs: 600, paddingMs: 120, minKeepMs: 450 },
  punchIn: { every: 4, scales: [1.05, 1.1], anchor: 'face-hint' },
  concepts: {
    minFrequency: 4,
    minTermLength: 5,
    dictionary: ['teorema', 'formula', 'concepto', 'diagrama', 'ejercicio', 'definicion'],
  },
  broll: {
    targetDurationMs: 3500,
    minDurationMs: 1500,
    maxDurationMs: 6000,
    noRepeatWindowMs: 30_000,
    minGapMs: 1500,
    maxCoverageRatio: 0.2,
    rolePriority: ['image', 'broll'],
    fit: 'pip',
  },
  captions: { maxWords: 3, maxDurationMs: 1600, minDurationMs: 380, maxGapMs: 640 },
  transitions: {
    every: 6,
    durationMs: 340,
    kinds: ['fade'],
    timing: 'linear',
  },
  audio: { baseGainDb: -12, duckedGainDb: -26, attackMs: 200, releaseMs: 500, holdMs: 320 },
};
