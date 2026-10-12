import type { VoiceDirectionDocument } from '../render-api-client';
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
    {
      id: 'es_AR-daniela-high',
      directory: 'vits-piper-es_AR-daniela-high',
      fileName: 'es_AR-daniela-high.onnx',
      isDefault: true,
      language: { code: 'es-AR', region: 'AR' },
      quality: 'high',
      label: 'Daniela \u00b7 Spanish (Argentina) \u00b7 High quality',
      description:
        'Neural voice trained on the "daniela" dataset. Spanish as spoken in Argentina, synthesized at 22050 Hz.',
      previewUrl: '/voices/es_AR-daniela-high/preview',
    },
    {
      id: 'es_ES-carlfm-x-low',
      directory: 'vits-piper-es_ES-carlfm-x-low',
      fileName: 'es_ES-carlfm-x-low.onnx',
      isDefault: false,
      language: { code: 'es-ES', region: 'ES' },
      quality: 'x_low',
      label: 'Carlfm \u00b7 Spanish (Spain) \u00b7 Very low quality',
      description:
        'Neural voice trained on the "carlfm" dataset. Spanish as spoken in Spain, synthesized at 16000 Hz.',
      previewUrl: '/voices/es_ES-carlfm-x-low/preview',
    },
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
      { name: 'ttsCli', envVar: 'TTS_CLI_PATH', resolved: true },
      { name: 'ttsVoicesDir', envVar: 'TTS_VOICES_DIR', resolved: true },
    ],
    capabilities: {
      renderPipeline: true,
      assetStore: true,
      jobQueue: true,
      montageQueue: true,
      storyboardQueue: true,
      voiceQueue: true,
      producer: true,
    },
    jobs: { running: 0, queued: 0 },
    ...overrides,
  };
}

export const VOICE_SCRIPT_MANIFEST = {
  schemaVersion: 1,
  source: 'script',
  language: 'es-AR',
  voiceId: 'es_AR-daniela-high',
  gapMs: 900,
  path: 'work/voice/voice.wav',
  wordsPath: 'work/voice/voice.words.json',
  durationMs: 63_480,
  sampleRate: 48_000,
  updatedAt: '2026-09-11T10:00:00.000Z',
  lines: [
    {
      index: 1,
      text: 'Cada anuncio arranca de una plantilla.',
      path: 'work/voice/lines/line-01.wav',
      startMs: 0,
      durationMs: 4_200,
      endMs: 4_200,
      requestedStartMs: 0,
    },
    {
      index: 2,
      text: 'El editor la ajusta en dos minutos.',
      path: 'work/voice/lines/line-02.wav',
      startMs: 22_000,
      durationMs: 5_400,
      endMs: 27_400,
      requestedStartMs: 22_000,
      overflowMs: 840,
    },
  ],
} as const;

export const VOICE_SCRIPT_MANIFEST_JSON = JSON.stringify(VOICE_SCRIPT_MANIFEST);

export function voiceDirectionDocument(
  overrides: Partial<VoiceDirectionDocument> = {},
): VoiceDirectionDocument {
  return {
    slug: 'smoke-ingest',
    path: 'work/producer/voice-direction.json',
    directions: {},
    lines: VOICE_SCRIPT_MANIFEST.lines.map((line) => ({ index: line.index, text: line.text })),
    ...overrides,
  };
}
