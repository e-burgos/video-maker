import type { LoudnessMeasurement, ResolvedBinaries } from '@video-maker/media-local';
import type { MediaAsset } from '@video-maker/timeline-core';

import type {
  RenderApiDependencies,
  RenderMutedVideoOutput,
} from '../deps/render-api-dependencies';
import { MEDIA_BINARY_NAMES } from '../engine/media-binaries';
import type { BinaryStatus, MediaBinaryName } from '../engine/media-binaries';
import type { CallLog } from './call-log';
import { createFakeCommandRunner } from './fake-command-runner';
import { createFakeObjectStorage } from './fake-object-storage';

const DEFAULT_RESOLVED_BINARIES: ResolvedBinaries = {
  ffmpeg: '/usr/bin/ffmpeg',
  ffprobe: '/usr/bin/ffprobe',
  whisperCli: '/usr/bin/whisper-cli',
  whisperModel: '/usr/share/whisper/model.bin',
};

const BINARY_ENV_VAR_NAMES: Readonly<Record<MediaBinaryName, string>> = {
  ffmpeg: 'FFMPEG_PATH',
  ffprobe: 'FFPROBE_PATH',
  whisperCli: 'WHISPER_CPP_PATH',
  whisperModel: 'WHISPER_MODEL_PATH',
};

const DEFAULT_MEDIA_BINARY_STATUSES: readonly BinaryStatus[] = MEDIA_BINARY_NAMES.map((name) => ({
  name,
  envVar: BINARY_ENV_VAR_NAMES[name],
  resolved: true,
}));

const DEFAULT_RENDER_OUTPUT: Omit<RenderMutedVideoOutput, 'outPath'> = {
  width: 1080,
  height: 1920,
  fps: 30,
  durationInFrames: 144,
};

const FIXED_NOW_ISO = '2026-09-08T00:00:00.000Z';

function createDeterministicRandomId(): () => string {
  let counter = 0;
  return () => {
    counter += 1;
    return `render-${String(counter).padStart(4, '0')}`;
  };
}

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
      return DEFAULT_MEDIA_BINARY_STATUSES;
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

    storage: overrides?.storage ?? createFakeObjectStorage(callLog),

    probeAsset: async (input) => {
      callLog.record('probeAsset', input);
      if (overrides?.probeAsset) {
        return overrides.probeAsset(input);
      }
      const asset: MediaAsset = {
        id: input.assetId,
        kind: 'video',
        path: input.assetId,
        durationMs: 12000,
        fps: 30,
        width: 1080,
        height: 1920,
        hasAudio: true,
        probedAt: FIXED_NOW_ISO,
      };
      return asset;
    },

    randomId: overrides?.randomId ?? createDeterministicRandomId(),

    clock: overrides?.clock ?? { nowIso: () => FIXED_NOW_ISO },

    logger: overrides?.logger ?? {
      info: () => undefined,
      error: () => undefined,
    },

    readDirectory: {
      readDirectory: async (path) => {
        callLog.record('readDirectory', path);
        if (overrides?.readDirectory) {
          return overrides.readDirectory.readDirectory(path);
        }
        return [];
      },
    },

    statFile: {
      statFile: async (path) => {
        callLog.record('statFile', path);
        if (overrides?.statFile) {
          return overrides.statFile.statFile(path);
        }
        return { sizeBytes: 0, modifiedAtMs: 0 };
      },
    },

    createCommandRunner: async () => {
      callLog.record('createCommandRunner', undefined);
      if (overrides?.createCommandRunner) {
        return overrides.createCommandRunner();
      }
      return createFakeCommandRunner([]);
    },

    resolveMontageBinaries: async () => {
      callLog.record('resolveMontageBinaries', undefined);
      if (overrides?.resolveMontageBinaries) {
        return overrides.resolveMontageBinaries();
      }
      return DEFAULT_RESOLVED_BINARIES;
    },
  };
}
