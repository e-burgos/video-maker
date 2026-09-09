import type { EditDecisionList, MediaAsset, MusicInput, Timeline } from '@video-maker/timeline-core';
import { buildTimeline, defaultFormat } from '@video-maker/timeline-core';

const FIXTURE_FORMAT = defaultFormat('reels-9x16');

const FIXTURE_AROLL_ASSET: MediaAsset = {
  id: 'aroll-cam-01',
  kind: 'video',
  path: 'raw/aroll/cam-01.mp4',
  durationMs: 30000,
  fps: 30,
  width: 1920,
  height: 1080,
  rotation: 0,
  hasAudio: true,
  audio: { sampleRate: 48000, channels: 2, codec: 'aac' },
  videoCodec: 'h264',
  probedAt: '2026-09-01T00:00:00.000Z',
};

const FIXTURE_BROLL_ASSET: MediaAsset = {
  id: 'broll-shot-01',
  kind: 'video',
  path: 'raw/broll/shot-01.mp4',
  durationMs: 20000,
  fps: 30,
  width: 1920,
  height: 1080,
  rotation: 0,
  hasAudio: false,
  videoCodec: 'h264',
  probedAt: '2026-09-01T00:00:00.000Z',
};

const FIXTURE_MUSIC_ASSET: MediaAsset = {
  id: 'raw/audio/music-01.mp3',
  kind: 'audio',
  path: 'raw/audio/music-01.mp3',
  durationMs: 20000,
  hasAudio: true,
  audio: { sampleRate: 44100, channels: 2, codec: 'mp3' },
  probedAt: '2026-09-01T00:00:00.000Z',
};

export const FIXTURE_ASSETS: readonly MediaAsset[] = [
  FIXTURE_AROLL_ASSET,
  FIXTURE_BROLL_ASSET,
  FIXTURE_MUSIC_ASSET,
];

export const FIXTURE_MUSIC: MusicInput = {
  assetId: FIXTURE_MUSIC_ASSET.id,
  trimStartMs: 1500,
  gainDb: -10,
  fadeInFrames: 15,
  fadeOutFrames: 20,
};

export const FIXTURE_EDL: EditDecisionList = {
  schemaVersion: 1,
  sourceAssetId: FIXTURE_AROLL_ASSET.id,
  format: FIXTURE_FORMAT,
  generatedBy: { tool: 'editable-timeline-fixture', params: {} },
  decisions: [
    { id: 'keep-0001', type: 'keep', startMs: 0, endMs: 4000 },
    { id: 'punch-0001', type: 'punch-in', startMs: 1000, endMs: 2000, scale: 1.15, anchor: 'center' },
    { id: 'duck-0001', type: 'duck', startMs: 500, endMs: 1200, gainDb: -18 },
    {
      id: 'caption-0001',
      type: 'caption-group',
      startMs: 300,
      endMs: 900,
      words: [
        { text: 'we', startMs: 300, endMs: 450 },
        { text: 'edit', startMs: 460, endMs: 700 },
        { text: 'video', startMs: 710, endMs: 900 },
      ],
      emphasisIndex: 2,
    },
    {
      id: 'transition-0001',
      type: 'transition',
      atMs: 4000,
      durationMs: 233,
      kind: 'whip-pan',
      direction: 'from-right',
    },
    { id: 'keep-0002', type: 'keep', startMs: 4000, endMs: 8000 },
    {
      id: 'broll-0001',
      type: 'broll-overlay',
      startMs: 4500,
      endMs: 5500,
      assetId: FIXTURE_BROLL_ASSET.id,
      fit: 'cover',
      keepVoice: false,
    },
    { id: 'duck-0002', type: 'duck', startMs: 5500, endMs: 6200, gainDb: -18 },
    {
      id: 'caption-0002',
      type: 'caption-group',
      startMs: 4300,
      endMs: 5000,
      words: [
        { text: 'nothing', startMs: 4300, endMs: 4600 },
        { text: 'wasted', startMs: 4610, endMs: 5000 },
      ],
      emphasisIndex: 1,
    },
  ],
};

export function editableTimelineFixture(): Timeline {
  return buildTimeline(FIXTURE_EDL, FIXTURE_ASSETS, FIXTURE_MUSIC);
}
