import type { CommandRunner, VideoScene } from '@video-maker/media-local';

export interface ReferenceProbe {
  readonly durationSec: number;
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly hasAudio: boolean;
}

export interface ReferenceSilence {
  readonly startSec: number;
  readonly endSec: number;
}

export interface ReferenceMeasurements {
  readonly probe: (path: string) => Promise<ReferenceProbe>;
  readonly detectScenes: (path: string, durationSec: number) => Promise<readonly VideoScene[]>;
  readonly measureLoudness: (path: string) => Promise<number | null>;
  readonly detectLongSilences: (path: string, durationSec: number) => Promise<readonly ReferenceSilence[]>;
  readonly extractKeyframes: (
    path: string,
    scenes: readonly VideoScene[],
    keyframePathFor: (scene: VideoScene) => string,
  ) => Promise<void>;
}

export interface FfmpegReferenceBinaries {
  readonly ffmpegPath: string;
  readonly ffprobePath: string;
}

export const REFERENCE_MIN_SCENE_SEC = 1.5;
export const REFERENCE_LONG_SILENCE_SEC = 1.5;
export const REFERENCE_SILENCE_NOISE_DB = -35;
const MILLISECONDS_PER_SECOND = 1000;

const loadMediaLocal = (): Promise<typeof import('@video-maker/media-local')> => import('@video-maker/media-local');

export function createFfmpegReferenceMeasurements(
  runner: CommandRunner,
  binaries: FfmpegReferenceBinaries,
): ReferenceMeasurements {
  const { ffmpegPath, ffprobePath } = binaries;
  return {
    probe: async (path) => {
      const { probeMedia } = await loadMediaLocal();
      const media = await probeMedia(path, runner, { ffprobePath });
      return {
        durationSec: media.durationMs / MILLISECONDS_PER_SECOND,
        width: media.width ?? 0,
        height: media.height ?? 0,
        fps: media.fps ?? 0,
        hasAudio: media.hasAudio === true,
      };
    },
    detectScenes: async (path, durationSec) => {
      const { buildScenesFromCuts, detectSceneCuts } = await loadMediaLocal();
      const cuts = await detectSceneCuts(path, runner, { minSceneSec: REFERENCE_MIN_SCENE_SEC, ffmpegPath });
      return buildScenesFromCuts(cuts, durationSec, REFERENCE_MIN_SCENE_SEC);
    },
    measureLoudness: async (path) => {
      const { DEFAULT_VOICE_TARGET, measureLoudness } = await loadMediaLocal();
      const measured = await measureLoudness(path, runner, { target: DEFAULT_VOICE_TARGET, ffmpegPath });
      return Number.isFinite(measured.integratedLufs) ? measured.integratedLufs : null;
    },
    detectLongSilences: async (path, durationSec) => {
      const { detectSilences } = await loadMediaLocal();
      const segments = await detectSilences(path, runner, {
        minDurationSec: REFERENCE_LONG_SILENCE_SEC,
        noiseDb: REFERENCE_SILENCE_NOISE_DB,
        audioDurationSec: durationSec,
        ffmpegPath,
      });
      return segments.map((segment) => ({ startSec: segment.startSec, endSec: segment.endSec }));
    },
    extractKeyframes: async (path, scenes, keyframePathFor) => {
      const { extractSceneKeyframes } = await loadMediaLocal();
      await extractSceneKeyframes(path, scenes, keyframePathFor, runner, { ffmpegPath });
    },
  };
}
