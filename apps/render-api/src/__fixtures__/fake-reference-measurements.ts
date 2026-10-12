import type { VideoScene } from '@video-maker/media-local';

import type { ReferenceMeasurements, ReferenceProbe } from '../reference/reference-measurements';

export interface FakeReferenceMeasurementsInit {
  readonly probe?: Partial<ReferenceProbe>;
  readonly cuts?: readonly number[];
  readonly loudness?: number | null;
  readonly silences?: ReadonlyArray<{ readonly startSec: number; readonly endSec: number }>;
}

function scenesFromCuts(cuts: readonly number[], durationSec: number): VideoScene[] {
  const boundaries = [0, ...cuts, durationSec];
  return boundaries.slice(0, -1).map((startSec, index) => {
    const endSec = boundaries[index + 1] ?? durationSec;
    return { index, startSec, endSec, durationSec: endSec - startSec };
  });
}

export function createFakeReferenceMeasurements(init: FakeReferenceMeasurementsInit = {}): ReferenceMeasurements {
  return {
    probe: () =>
      Promise.resolve({ durationSec: 30, width: 1080, height: 1920, fps: 30, hasAudio: true, ...init.probe }),
    detectScenes: (_path, durationSec) => Promise.resolve(scenesFromCuts(init.cuts ?? [10, 20], durationSec)),
    measureLoudness: () => Promise.resolve(init.loudness === undefined ? -16.4 : init.loudness),
    detectLongSilences: () => Promise.resolve(init.silences ?? []),
    extractKeyframes: () => Promise.resolve(),
  };
}
