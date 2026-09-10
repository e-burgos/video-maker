import type { MontagePreset } from './montage-preset';

export const hardwarePreset: MontagePreset = {
  name: 'hardware',
  silence: { minSilenceMs: 450, paddingMs: 80, minKeepMs: 300 },
  punchIn: { every: 2, scales: [1.12, 1.18], anchor: 'center' },
  concepts: {
    minFrequency: 3,
    minTermLength: 4,
    dictionary: ['puerto', 'bateria', 'procesador', 'memoria', 'ventilador', 'carcasa'],
  },
  broll: {
    targetDurationMs: 3000,
    minDurationMs: 1500,
    maxDurationMs: 5000,
    noRepeatWindowMs: 20_000,
    minGapMs: 1000,
    maxCoverageRatio: 0.45,
    rolePriority: ['image', 'broll'],
    fit: 'cover',
  },
  captions: { maxWords: 3, maxDurationMs: 1300, minDurationMs: 320, maxGapMs: 520 },
  transitions: {
    every: 3,
    durationMs: 260,
    kinds: ['slide', 'fade'],
    timing: 'spring',
  },
  audio: { baseGainDb: -4, duckedGainDb: -12, referenceLufs: -16, attackMs: 150, releaseMs: 400, holdMs: 250 },
};
