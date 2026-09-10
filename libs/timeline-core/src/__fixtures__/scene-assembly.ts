import type { MediaAsset } from '../schemas/media-asset.schema';
import type { SceneAssignment } from '../schemas/scene-assignment.schema';
import type { StoryboardDocument } from '../schemas/storyboard.schema';
import type { VoiceManifest } from '../schemas/voice-manifest.schema';

const PROBED_AT = '2026-09-10T00:00:00.000Z';

export const sceneImageAsset: MediaAsset = {
  id: 'raw/images/01.png',
  kind: 'image',
  path: 'raw/images/01.png',
  durationMs: 0,
  width: 1080,
  height: 1920,
  probedAt: PROBED_AT,
};

export const sceneVideoAsset: MediaAsset = {
  id: 'raw/broll/02.mp4',
  kind: 'video',
  path: 'raw/broll/02.mp4',
  durationMs: 4000,
  fps: 30,
  width: 1080,
  height: 1920,
  hasAudio: false,
  videoCodec: 'h264',
  probedAt: PROBED_AT,
};

export const sceneMusicAsset: MediaAsset = {
  id: 'raw/audio/music01.mp3',
  kind: 'audio',
  path: 'raw/audio/music01.mp3',
  durationMs: 120_000,
  hasAudio: true,
  audio: { sampleRate: 44_100, channels: 2, codec: 'mp3' },
  probedAt: PROBED_AT,
};

function voiceAsset(sceneId: string, durationMs: number): MediaAsset {
  return {
    id: `work/voice/${sceneId}.wav`,
    kind: 'audio',
    path: `work/voice/${sceneId}.wav`,
    durationMs,
    hasAudio: true,
    audio: { sampleRate: 48_000, channels: 1, codec: 'pcm_s16le' },
    probedAt: PROBED_AT,
  };
}

export const sceneVoiceAssets: readonly MediaAsset[] = [
  voiceAsset('scene-01', 3000),
  voiceAsset('scene-02', 5886),
];

export const sceneAssemblyAssets: readonly MediaAsset[] = [
  sceneImageAsset,
  sceneVideoAsset,
  sceneMusicAsset,
  ...sceneVoiceAssets,
];

export const sceneAssemblyStoryboard: StoryboardDocument = {
  schemaVersion: 1,
  id: 'storyboard-assembly',
  source: 'brief',
  createdAt: '2026-09-10T12:00:00.000Z',
  title: 'Cómo montar una escena',
  language: 'es-AR',
  format: '9:16',
  captionsStyle: 'kinetic-bold',
  musicTags: ['upbeat'],
  characters: [],
  scenes: [
    {
      id: 'scene-01',
      index: 1,
      narration: 'Primero elegís el plano.',
      visualPrompt: 'A kitchen at dawn, vertical framing.',
      visualSource: 'upload',
      estimatedDurationMs: 9000,
      musicTags: [],
      sfxTags: [],
    },
    {
      id: 'scene-02',
      index: 2,
      narration: 'Después le ponés el título.',
      visualPrompt: 'A bold title card.',
      visualSource: 'remotion-scene',
      remotionScene: { kind: 'title', title: 'Escena dos', subtitle: 'Bajada' },
      estimatedDurationMs: 9000,
      musicTags: [],
      sfxTags: [],
    },
    {
      id: 'scene-03',
      index: 3,
      narration: 'Y cerrás con el B-roll.',
      visualPrompt: 'A slow pan over the finished dish.',
      visualSource: 'asset',
      assetId: 'raw/broll/02.mp4',
      estimatedDurationMs: 2000,
      musicTags: [],
      sfxTags: [],
    },
  ],
};

export const sceneAssemblyVoice: VoiceManifest = {
  schemaVersion: 1,
  storyboardId: 'storyboard-assembly',
  language: 'es-AR',
  tracks: [
    {
      sceneId: 'scene-01',
      index: 1,
      source: 'generated',
      path: 'work/voice/scene-01.wav',
      wordsPath: 'work/voice/scene-01.words.json',
      durationMs: 3000,
      sampleRate: 48_000,
      voiceId: 'es_AR-daniela-high',
      narrationHash: 'hash-01',
      updatedAt: '2026-09-10T12:00:00.000Z',
    },
    {
      sceneId: 'scene-02',
      index: 2,
      source: 'generated',
      path: 'work/voice/scene-02.wav',
      wordsPath: 'work/voice/scene-02.words.json',
      durationMs: 5886,
      sampleRate: 48_000,
      voiceId: 'es_AR-daniela-high',
      narrationHash: 'hash-02',
      updatedAt: '2026-09-10T12:00:00.000Z',
    },
  ],
};

export const sceneAssemblyAssignment: SceneAssignment = {
  schemaVersion: 1,
  storyboardId: 'storyboard-assembly',
  assignments: [{ sceneId: 'scene-01', assetId: 'raw/images/01.png' }],
};
