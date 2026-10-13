import type { ReviewMeasurements } from '../review/review-measurements';

export interface FakeReviewMeasurementsInit {
  readonly durationSec: number;
  readonly levels?: (path: string, startSec: number) => number | null;
  readonly master?: { integratedLufs: number; truePeakDbtp: number };
}

export function createFakeReviewMeasurements(init: FakeReviewMeasurementsInit): ReviewMeasurements {
  return {
    measureMaster: () => Promise.resolve(init.master ?? { integratedLufs: -14, truePeakDbtp: -2 }),
    probeDurationSec: () => Promise.resolve(init.durationSec),
    detectBlack: () => Promise.resolve([]),
    detectFrozen: () => Promise.resolve([]),
    detectSilences: () => Promise.resolve([]),
    extractFrame: () => Promise.resolve(),
    measureSegments: (path, segments) =>
      Promise.resolve(segments.map((segment) => init.levels?.(path, segment.startSec) ?? -20)),
  };
}
