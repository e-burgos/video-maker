import type { LoudnessMeasurement } from '@video-maker/media-local';

import type {
  RenderApiDependencies,
  RenderMutedVideoOutput,
} from '../deps/render-api-dependencies';
import type { CallLog } from './call-log';

const DEFAULT_RENDER_OUTPUT: Omit<RenderMutedVideoOutput, 'outPath'> = {
  width: 1080,
  height: 1920,
  fps: 30,
  durationInFrames: 144,
};

const FIXED_NOW_ISO = '2026-09-08T00:00:00.000Z';

export function createFakeRenderApiDependencies(
  callLog: CallLog,
  overrides?: Partial<RenderApiDependencies>,
): RenderApiDependencies {
  return {
    renderMutedVideo: async (input) => {
      callLog.record('renderMutedVideo', input);
      if (overrides?.renderMutedVideo) {
        return overrides.renderMutedVideo(input);
      }
      return { outPath: input.outPath, ...DEFAULT_RENDER_OUTPUT };
    },

    mixTimelineAudio: async (input) => {
      callLog.record('mixTimelineAudio', input);
      if (overrides?.mixTimelineAudio) {
        return overrides.mixTimelineAudio(input);
      }
      return { outputPath: input.outPath, filterComplex: '[0:a]anull[mixed]' };
    },

    muxAudioIntoVideo: async (input) => {
      callLog.record('muxAudioIntoVideo', input);
      if (overrides?.muxAudioIntoVideo) {
        return overrides.muxAudioIntoVideo(input);
      }
      return { outputPath: input.outPath };
    },

    verifyMixLoudness: async (input) => {
      callLog.record('verifyMixLoudness', input);
      if (overrides?.verifyMixLoudness) {
        return overrides.verifyMixLoudness(input);
      }
      const measured: LoudnessMeasurement = {
        integratedLufs: input.target.integratedLufs,
        truePeakDbtp: input.target.truePeakDbtp,
        loudnessRange: input.target.loudnessRange,
        thresholdLufs: input.target.integratedLufs,
        targetOffsetDb: 0,
      };
      return { measured, withinTolerance: true, integratedDeltaLu: 0, truePeakDeltaDb: 0 };
    },

    ensureDirectory: async (path) => {
      callLog.record('ensureDirectory', path);
      if (overrides?.ensureDirectory) {
        await overrides.ensureDirectory(path);
      }
    },

    probeMediaBinaries: async () => {
      callLog.record('probeMediaBinaries', undefined);
      if (overrides?.probeMediaBinaries) {
        return overrides.probeMediaBinaries();
      }
      return [
        { name: 'ffmpeg', envVar: 'FFMPEG_PATH', resolved: true },
        { name: 'ffprobe', envVar: 'FFPROBE_PATH', resolved: true },
      ];
    },

    preloadEngineModules: async () => {
      callLog.record('preloadEngineModules', undefined);
      if (overrides?.preloadEngineModules) {
        return overrides.preloadEngineModules();
      }
      return [
        { name: 'media-local', loaded: true },
        { name: 'composition-remotion/render', loaded: true },
      ];
    },

    clock: overrides?.clock ?? { nowIso: () => FIXED_NOW_ISO },

    logger: overrides?.logger ?? {
      info: () => undefined,
      error: () => undefined,
    },
  };
}
