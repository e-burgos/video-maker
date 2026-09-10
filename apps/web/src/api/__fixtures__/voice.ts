import type {
  ServiceHealth,
  VoiceDocument,
  VoiceJob,
  VoiceListing,
  VoiceManifest,
  VoiceTrack,
} from '../render-api-types';

export const VOICE_MODELS: VoiceListing = {
  voices: [
    { id: 'es_AR-daniela-high', fileName: 'es_AR-daniela-high.onnx', isDefault: true },
    { id: 'es_ES-carlfm-x-low', fileName: 'es_ES-carlfm-x-low.onnx', isDefault: false },
  ],
};

export function voiceTrack(overrides: Partial<VoiceTrack> = {}): VoiceTrack {
  return {
    sceneId: 'scene-01',
    index: 1,
    source: 'generated',
    path: 'work/voice/scene-01.wav',
    wordsPath: 'work/voice/scene-01.words.json',
    durationMs: 3100,
    sampleRate: 48000,
    voiceId: 'es_AR-daniela-high',
    narrationHash: 'f121ad99f5e514ca',
    updatedAt: '2026-09-09T02:36:24.555Z',
    ...overrides,
  };
}

export function voiceManifest(tracks: VoiceTrack[]): VoiceManifest {
  return {
    schemaVersion: 1,
    storyboardId: '5861fd3e-f065-4e9f-abc2-868b4a4acc64',
    language: 'es-AR',
    tracks,
  };
}

export function voiceDocument(overrides: Partial<VoiceDocument> = {}): VoiceDocument {
  const tracks = [
    voiceTrack(),
    voiceTrack({
      sceneId: 'scene-02',
      index: 2,
      path: 'work/voice/scene-02.wav',
      wordsPath: 'work/voice/scene-02.words.json',
      durationMs: 5561,
    }),
  ];

  return {
    slug: 'smoke-ingest',
    manifest: voiceManifest(tracks),
    scenes: [
      { sceneId: 'scene-01', index: 1, source: 'generated', stale: false },
      { sceneId: 'scene-02', index: 2, source: 'generated', stale: true },
    ],
    ...overrides,
  };
}

export function voiceJob(overrides: Partial<VoiceJob> = {}): VoiceJob {
  return {
    id: 'job-voice-1',
    kind: 'voice',
    slug: 'smoke-ingest',
    state: 'running',
    createdAt: '2026-09-09T02:36:00.000Z',
    startedAt: '2026-09-09T02:36:01.000Z',
    finishedAt: null,
    progress: { stage: 'synthesize', processedScenes: 2, totalScenes: 5, percent: 40 },
    report: null,
    error: null,
    ...overrides,
  };
}

export function healthyVoiceService(overrides: Partial<ServiceHealth> = {}): ServiceHealth {
  return {
    status: 'ok',
    service: 'render-api',
    cycle: 3,
    time: '2026-09-09T02:36:00.000Z',
    engine: [{ name: 'timeline-core', loaded: true }],
    binaries: [
      { name: 'ffmpeg', envVar: 'FFMPEG_PATH', resolved: true },
      { name: 'ffprobe', envVar: 'FFPROBE_PATH', resolved: true },
      { name: 'whisperCli', envVar: 'WHISPER_CPP_PATH', resolved: true },
      { name: 'whisperModel', envVar: 'WHISPER_MODEL_PATH', resolved: true },
      { name: 'piperCli', envVar: 'PIPER_PATH', resolved: true },
      { name: 'piperModel', envVar: 'PIPER_MODEL_PATH', resolved: true },
    ],
    capabilities: {
      renderPipeline: true,
      assetStore: true,
      jobQueue: true,
      montageQueue: true,
      storyboardQueue: true,
      voiceQueue: true,
    },
    jobs: { running: 0, queued: 0 },
    ...overrides,
  };
}
