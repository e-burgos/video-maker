import { buildTimeline, defaultFormat } from '@video-maker/timeline-core';
import type { EditDecisionList, MediaAsset, Timeline } from '@video-maker/timeline-core';

const MINIMAL_TIMELINE_ASSETS: readonly MediaAsset[] = [
  {
    id: 'minimal-aroll',
    kind: 'video',
    path: 'fixtures/minimal-aroll.mp4',
    durationMs: 6_000,
    fps: 30,
    width: 1080,
    height: 1920,
    rotation: 0,
    hasAudio: true,
    audio: { sampleRate: 48_000, channels: 2, codec: 'aac' },
    videoCodec: 'h264',
    probedAt: '2026-09-08T00:00:00.000Z',
  },
];

const MINIMAL_TIMELINE_EDL: EditDecisionList = {
  schemaVersion: 1,
  sourceAssetId: 'minimal-aroll',
  format: defaultFormat('reels-9x16'),
  generatedBy: { tool: 'producer-tools-fixture', params: {} },
  decisions: [{ id: 'keep-0001', type: 'keep', startMs: 1_200, endMs: 5_400 }],
};

export function buildMinimalTimeline(): Timeline {
  return buildTimeline(MINIMAL_TIMELINE_EDL, MINIMAL_TIMELINE_ASSETS);
}
