import type { OutputPreset, Timeline } from '@video-maker/timeline-core';
import { buildTimeline, defaultFormat } from '@video-maker/timeline-core';
import { exampleAssets, exampleEdl } from './example-edl';

export type ExampleTimelinePreset = Extract<OutputPreset, 'reels-9x16' | 'youtube-16x9'>;

export function buildExampleTimeline(preset: ExampleTimelinePreset): Timeline {
  const edl = { ...exampleEdl, format: defaultFormat(preset) };
  return buildTimeline(edl, exampleAssets, { assetId: 'music-bed-01' });
}
