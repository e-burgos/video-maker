import type { CommandRunner, TimeSegment } from '@video-maker/media-local';

import type { ReviewMasterLevels, SecondsRange } from './review-inputs';

export interface ReviewMeasurements {
  readonly measureMaster: (path: string) => Promise<ReviewMasterLevels>;
  readonly probeDurationSec: (path: string) => Promise<number>;
  readonly detectBlack: (path: string, minDurationSec: number) => Promise<readonly SecondsRange[]>;
  readonly detectFrozen: (path: string, minDurationSec: number, videoDurationSec: number) => Promise<readonly SecondsRange[]>;
  readonly detectSilences: (
    path: string,
    minDurationSec: number,
    noiseDb: number,
    audioDurationSec: number,
  ) => Promise<readonly SecondsRange[]>;
  readonly measureSegments: (path: string, segments: readonly TimeSegment[]) => Promise<ReadonlyArray<number | null>>;
}

export interface FfmpegReviewBinaries {
  readonly ffmpegPath: string;
  readonly ffprobePath: string;
}

const MILLISECONDS_PER_SECOND = 1000;

const loadMediaLocal = (): Promise<typeof import('@video-maker/media-local')> => import('@video-maker/media-local');

export function createFfmpegReviewMeasurements(
  runner: CommandRunner,
  binaries: FfmpegReviewBinaries,
): ReviewMeasurements {
  const { ffmpegPath, ffprobePath } = binaries;
  return {
    measureMaster: async (path) => {
      const { DEFAULT_VOICE_TARGET, measureLoudness } = await loadMediaLocal();
      const measured = await measureLoudness(path, runner, { target: DEFAULT_VOICE_TARGET, ffmpegPath });
      return { integratedLufs: measured.integratedLufs, truePeakDbtp: measured.truePeakDbtp };
    },
    probeDurationSec: async (path) => {
      const { probeMedia } = await loadMediaLocal();
      const probed = await probeMedia(path, runner, { ffprobePath });
      return probed.durationMs / MILLISECONDS_PER_SECOND;
    },
    detectBlack: async (path, minDurationSec) => {
      const { detectBlackSegments } = await loadMediaLocal();
      return detectBlackSegments(path, runner, { minDurationSec, ffmpegPath });
    },
    detectFrozen: async (path, minDurationSec, videoDurationSec) => {
      const { detectFrozenSegments } = await loadMediaLocal();
      return detectFrozenSegments(path, runner, { minDurationSec, videoDurationSec, ffmpegPath });
    },
    detectSilences: async (path, minDurationSec, noiseDb, audioDurationSec) => {
      const { detectSilences } = await loadMediaLocal();
      return detectSilences(path, runner, { minDurationSec, noiseDb, audioDurationSec, ffmpegPath });
    },
    measureSegments: async (path, segments) => {
      const { measureSegmentLoudness } = await loadMediaLocal();
      return measureSegmentLoudness(path, segments, runner, { ffmpegPath });
    },
  };
}
