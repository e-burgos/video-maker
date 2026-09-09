import type { OutputPreset, Timeline } from '@video-maker/timeline-core';
import { defaultFormat, safeZoneFor } from '@video-maker/timeline-core';

export const PREVIEW_PRESETS = ['reels-9x16', 'youtube-16x9'] as const satisfies readonly OutputPreset[];

export type PreviewPreset = (typeof PREVIEW_PRESETS)[number];

export function previewPresetFor(timeline: Timeline): PreviewPreset {
  return timeline.format.preset === 'youtube-16x9' ? 'youtube-16x9' : 'reels-9x16';
}

export function previewFormat(timeline: Timeline, preset: PreviewPreset): Timeline {
  if (timeline.format.preset === preset) {
    return timeline;
  }

  const format = defaultFormat(preset);

  return { ...timeline, format, safeZone: safeZoneFor(format) };
}
