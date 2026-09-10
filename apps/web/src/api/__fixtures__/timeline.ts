import type { Timeline } from '@video-maker/timeline-core';
import { TimelineSchema } from '@video-maker/timeline-core';

const RAW_TIMELINE = {
  schemaVersion: 1,
  id: 'timeline-preview',
  format: { preset: 'reels-9x16', width: 1080, height: 1920, fps: 30 },
  durationFrames: 120,
  assets: [
    {
      id: 'raw/aroll/clip 01.mp4',
      kind: 'video',
      path: 'raw/aroll/clip 01.mp4',
      durationMs: 22500,
      fps: 30,
      width: 1280,
      height: 720,
      rotation: 0,
      hasAudio: true,
      audio: { sampleRate: 16000, channels: 1, codec: 'aac' },
      videoCodec: 'h264',
      probedAt: '2026-09-08T15:45:12.322Z',
    },
    {
      id: 'raw/audio/music01.mp3',
      kind: 'audio',
      path: 'raw/audio/music01.mp3',
      durationMs: 40183,
      hasAudio: true,
      audio: { sampleRate: 44100, channels: 2, codec: 'mp3' },
      probedAt: '2026-09-08T15:45:12.367Z',
    },
  ],
  tracks: {
    aroll: [
      {
        id: 'aroll-0001',
        assetId: 'raw/aroll/clip 01.mp4',
        from: 0,
        durationFrames: 120,
        trimStartMs: 0,
        transform: { scale: 1, translateX: 0, translateY: 0 },
        muted: true,
      },
    ],
    broll: [],
    voice: [
      {
        id: 'voice-0001',
        assetId: 'raw/aroll/clip 01.mp4',
        from: 0,
        durationFrames: 120,
        trimStartMs: 0,
        gainDb: 0,
      },
    ],
    music: [
      {
        id: 'music-0001',
        assetId: 'raw/audio/music01.mp3',
        from: 0,
        durationFrames: 120,
        trimStartMs: 0,
        gainDb: -12,
      },
    ],
    captions: [
      {
        id: 'caption-0001',
        from: 0,
        durationFrames: 40,
        words: [{ text: 'preview', fromFrame: 0, durationFrames: 40 }],
      },
    ],
  },
  audioMix: {
    voice: { integratedLufs: -14, truePeakDbtp: -1, loudnessRange: 11 },
    music: { baseGainDb: -12, duckedGainDb: -24, referenceLufs: -16, attackMs: 150, releaseMs: 400, holdMs: 250 },
    automation: [{ frame: 0, gainDb: -24 }],
  },
  safeZone: { top: 220, bottom: 400, left: 60, right: 140 },
};

export function previewTimelineFixture(): Timeline {
  return TimelineSchema.parse(structuredClone(RAW_TIMELINE));
}

export const RAW_PREVIEW_TIMELINE: unknown = RAW_TIMELINE;
