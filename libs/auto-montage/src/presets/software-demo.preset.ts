import type { MontagePreset } from './montage-preset';

export const softwareDemoPreset: MontagePreset = {
  name: 'software-demo',
  silence: { minSilenceMs: 400, paddingMs: 70, minKeepMs: 250 },
  punchIn: { every: 3, scales: [1.08, 1.12], anchor: 'face-hint' },
  concepts: {
    minFrequency: 3,
    minTermLength: 4,
    dictionary: ['terminal', 'comando', 'instalar', 'deploy', 'consola', 'script'],
  },
  broll: {
    targetDurationMs: 2500,
    minDurationMs: 1200,
    maxDurationMs: 4000,
    noRepeatWindowMs: 15_000,
    minGapMs: 800,
    maxCoverageRatio: 0.35,
    rolePriority: ['broll', 'image'],
    fit: 'cover',
  },
  captions: { maxWords: 3, maxDurationMs: 1200, minDurationMs: 300, maxGapMs: 500 },
  transitions: {
    every: 4,
    durationMs: 220,
    kinds: ['whip-pan', 'fade'],
    timing: 'spring',
  },
  audio: { baseGainDb: -8, duckedGainDb: -18, referenceLufs: -16, attackMs: 150, releaseMs: 400, holdMs: 250 },
};
