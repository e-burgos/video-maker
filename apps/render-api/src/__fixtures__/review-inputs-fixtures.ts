import type { ReviewInputs } from '../review/review-inputs';

const SAFE_ZONE = { top: 60, bottom: 60, left: 60, right: 60 };

export function footageReviewInputs(overrides?: Partial<ReviewInputs>): ReviewInputs {
  return {
    file: 'out/tutorial.mp4',
    mode: 'footage',
    createdAt: '2026-10-11T12:00:00.000Z',
    delivery: { kind: 'tutorial' },
    fps: 30,
    expectedDurationSec: 60,
    actualDurationSec: 60,
    master: { integratedLufs: -14.2, truePeakDbtp: -1.5 },
    bumpers: [{ startSec: 0, endSec: 2 }, { startSec: 58, endSec: 60 }],
    voiceSegments: [
      { startSec: 3, endSec: 10, voiceLufs: -14, musicLufs: -16, musicGainDb: -18 },
      { startSec: 20, endSec: 30, voiceLufs: -14, musicLufs: -16, musicGainDb: -18 },
    ],
    hasVoice: true,
    captionStyle: 'subtle-lower',
    captions: [
      {
        id: 'caption-0001',
        startSec: 3,
        endSec: 6,
        text: 'Las campañas viven en este módulo.',
        box: { x: 60, y: 60, width: 1800, height: 960 },
      },
    ],
    frame: { width: 1920, height: 1080, safeZone: SAFE_ZONE },
    blackSegments: [],
    frozenSegments: [],
    silences: [],
    missingAssets: [],
    ...overrides,
  };
}

export function motionReviewInputs(overrides?: Partial<ReviewInputs>): ReviewInputs {
  return {
    file: 'out/motion.mp4',
    mode: 'motion',
    createdAt: '2026-10-11T12:00:00.000Z',
    delivery: { kind: 'motion' },
    fps: 30,
    expectedDurationSec: 30,
    actualDurationSec: 30,
    master: { integratedLufs: -14, truePeakDbtp: -2 },
    bumpers: [],
    voiceSegments: [
      { startSec: 0.25, endSec: 3.2, voiceLufs: -20, musicLufs: -24, musicGainDb: -17.9 },
      { startSec: 4, endSec: 8, voiceLufs: -20, musicLufs: -24, musicGainDb: -17.9 },
    ],
    hasVoice: true,
    captionStyle: null,
    captions: [],
    frame: null,
    blackSegments: [],
    frozenSegments: [],
    silences: [],
    missingAssets: [],
    ...overrides,
  };
}
