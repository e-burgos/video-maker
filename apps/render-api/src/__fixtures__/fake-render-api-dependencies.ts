import {
  createJobsRepository,
  createOrganizationRepository,
  createProducerRepository,
  createProjectsRepository,
  createSettingsRepository,
  openStudioDatabase,
} from '@video-maker/local-store';
import type {
  LoudnessMeasurement,
  ResolvedBinaries,
  ResolvedVoiceBinaries,
  VoiceModel,
} from '@video-maker/media-local';
import type { MediaAsset, Transcription } from '@video-maker/timeline-core';

import type {
  Clock,
  LocalStorePort,
  RenderApiDependencies,
  RenderMutedVideoOutput,
} from '../deps/render-api-dependencies';
import { MEDIA_BINARY_NAMES } from '../engine/media-binaries';
import type { BinaryStatus, MediaBinaryName } from '../engine/media-binaries';
import type { CallLog } from './call-log';
import { createFakeCommandRunner } from './fake-command-runner';
import { createFakeObjectStorage } from './fake-object-storage';
import { createFakeVoicePreviewCache } from './fake-voice-preview-cache';

const DEFAULT_RESOLVED_BINARIES: ResolvedBinaries = {
  ffmpeg: '/usr/bin/ffmpeg',
  ffprobe: '/usr/bin/ffprobe',
  whisperCli: '/usr/bin/whisper-cli',
  whisperModel: '/usr/share/whisper/model.bin',
};

const DEFAULT_RESOLVED_VOICE_BINARIES: ResolvedVoiceBinaries = {
  ...DEFAULT_RESOLVED_BINARIES,
  piperCli: '/usr/bin/piper',
  piperModel: '/usr/share/piper/es_AR-daniela-high.onnx',
};

const DEFAULT_VOICE_MODELS: readonly VoiceModel[] = [
  {
    id: 'es_AR-daniela-high',
    fileName: 'es_AR-daniela-high.onnx',
    isDefault: true,
    language: { code: 'es-AR', region: 'AR' },
    quality: 'high',
    label: 'Daniela \u00b7 Spanish (Argentina) \u00b7 High quality',
    description:
      'Neural voice trained on the "daniela" dataset. Spanish as spoken in Argentina, synthesized at 22050 Hz.',
  },
  {
    id: 'es_ES-sharvard-medium',
    fileName: 'es_ES-sharvard-medium.onnx',
    isDefault: false,
    language: { code: 'es-ES', region: 'ES' },
    quality: 'medium',
    label: 'Sharvard \u00b7 Spanish (Spain) \u00b7 Medium quality',
    description:
      'Neural voice trained on the "sharvard" dataset. Spanish as spoken in Spain, synthesized at 22050 Hz.',
  },
];

const BINARY_ENV_VAR_NAMES: Readonly<Record<MediaBinaryName, string>> = {
  ffmpeg: 'FFMPEG_PATH',
  ffprobe: 'FFPROBE_PATH',
  whisperCli: 'WHISPER_CPP_PATH',
  whisperModel: 'WHISPER_MODEL_PATH',
  piperCli: 'PIPER_PATH',
  piperModel: 'PIPER_MODEL_PATH',
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

function createFakeLocalStore(clock: Clock): LocalStorePort {
  const database = openStudioDatabase(':memory:');
  const nowIso = (): string => clock.nowIso();
  return {
    projects: createProjectsRepository(database.db, nowIso),
    organization: createOrganizationRepository(database.db),
    producer: createProducerRepository(database.db),
    jobs: createJobsRepository(database.db),
    settings: createSettingsRepository(database.db, nowIso),
    close: () => database.close(),
  };
}

export function createFakeRenderApiDependencies(
  callLog: CallLog,
  overrides?: Partial<RenderApiDependencies>,
): RenderApiDependencies {
  const clock = overrides?.clock ?? { nowIso: () => FIXED_NOW_ISO };

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

    localStore: overrides?.localStore ?? createFakeLocalStore(clock),

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

    extractFrame: async (input) => {
      callLog.record('extractFrame', input);
      if (overrides?.extractFrame) {
        await overrides.extractFrame(input);
      }
    },

    fetchRemote: async (url, init) => {
      callLog.record('fetchRemote', { url, init });
      if (overrides?.fetchRemote) {
        return overrides.fetchRemote(url, init);
      }
      throw new Error('createFakeRenderApiDependencies: no fetchRemote override configured');
    },

    buildKenBurnsClip: async (input) => {
      callLog.record('buildKenBurnsClip', input);
      if (overrides?.buildKenBurnsClip) {
        await overrides.buildKenBurnsClip(input);
      }
    },

    concatVideoClips: async (input) => {
      callLog.record('concatVideoClips', input);
      if (overrides?.concatVideoClips) {
        await overrides.concatVideoClips(input);
      }
    },

    randomId: overrides?.randomId ?? createDeterministicRandomId(),

    clock,

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

    aiAgent: async (request) => {
      callLog.record('aiAgent', request);
      if (overrides?.aiAgent) {
        return overrides.aiAgent(request);
      }
      throw new Error('createFakeRenderApiDependencies: no aiAgent override configured');
    },

    producerAgent: (start, onLine) => {
      callLog.record('producerAgent', start);
      if (overrides?.producerAgent) {
        return overrides.producerAgent(start, onLine);
      }
      throw new Error('createFakeRenderApiDependencies: no producerAgent override configured');
    },

    probeProducerBinary: async () => {
      callLog.record('probeProducerBinary', undefined);
      if (overrides?.probeProducerBinary) {
        return overrides.probeProducerBinary();
      }
      return true;
    },

    resolveVoiceBinaries: async () => {
      callLog.record('resolveVoiceBinaries', undefined);
      if (overrides?.resolveVoiceBinaries) {
        return overrides.resolveVoiceBinaries();
      }
      return DEFAULT_RESOLVED_VOICE_BINARIES;
    },

    voicePreviewCache: overrides?.voicePreviewCache ?? createFakeVoicePreviewCache(callLog),

    listVoiceModels: async () => {
      callLog.record('listVoiceModels', undefined);
      if (overrides?.listVoiceModels) {
        return overrides.listVoiceModels();
      }
      return DEFAULT_VOICE_MODELS;
    },

    synthesizeVoice: async (input) => {
      callLog.record('synthesizeVoice', input);
      if (overrides?.synthesizeVoice) {
        await overrides.synthesizeVoice(input);
      }
    },

    extractVoiceAudio: async (input) => {
      callLog.record('extractVoiceAudio', input);
      if (overrides?.extractVoiceAudio) {
        await overrides.extractVoiceAudio(input);
      }
    },

    concatVoiceTracks: async (input) => {
      callLog.record('concatVoiceTracks', input);
      if (overrides?.concatVoiceTracks) {
        await overrides.concatVoiceTracks(input);
      }
    },

    placeVoiceTracks: async (input) => {
      callLog.record('placeVoiceTracks', input);
      if (overrides?.placeVoiceTracks) {
        await overrides.placeVoiceTracks(input);
      }
    },

    transcribeVoice: async (input) => {
      callLog.record('transcribeVoice', input);
      if (overrides?.transcribeVoice) {
        return overrides.transcribeVoice(input);
      }
      const transcription: Transcription = {
        assetId: input.assetId,
        engine: 'whisper.cpp',
        language: input.language,
        words: [
          { text: 'hola', startMs: 0, endMs: 400 },
          { text: 'mundo', startMs: 400, endMs: 900 },
        ],
        segments: [{ startMs: 0, endMs: 900, text: 'hola mundo', wordRange: [0, 2] }],
      };
      return transcription;
    },
  };
}
