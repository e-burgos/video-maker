import type { MediaAsset } from '../schemas/media-asset.schema';

export const arollAsset: MediaAsset = {
  id: 'aroll-cam-01',
  kind: 'video',
  path: '/fixtures/aroll-cam-01.mp4',
  durationMs: 10_000,
  fps: 30,
  width: 1080,
  height: 1920,
  rotation: 0,
  hasAudio: true,
  audio: { sampleRate: 48_000, channels: 2, codec: 'aac' },
  videoCodec: 'h264',
  probedAt: '2026-09-07T00:00:00.000Z',
};

export const brollAsset: MediaAsset = {
  id: 'broll-shot-01',
  kind: 'image',
  path: '/fixtures/broll-shot-01.jpg',
  durationMs: 0,
  width: 1080,
  height: 1920,
  probedAt: '2026-09-07T00:00:00.000Z',
};

export const musicAsset: MediaAsset = {
  id: 'music-bed-01',
  kind: 'audio',
  path: '/fixtures/music-bed-01.mp3',
  durationMs: 120_000,
  hasAudio: true,
  audio: { sampleRate: 44_100, channels: 2, codec: 'mp3', integratedLufs: -16 },
  probedAt: '2026-09-07T00:00:00.000Z',
};

export const ca013Assets = [arollAsset, brollAsset, musicAsset] as const;
