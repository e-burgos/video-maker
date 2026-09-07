import type { Timeline } from '@video-maker/timeline-core';
import { TimelineSchema } from '@video-maker/timeline-core';

export interface TimelineMetadata {
  timeline: Timeline;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
}

export function computeTimelineMetadata(timeline: Timeline): TimelineMetadata {
  const parsed = TimelineSchema.parse(timeline);

  return {
    timeline: parsed,
    durationInFrames: parsed.durationFrames,
    fps: parsed.format.fps,
    width: parsed.format.width,
    height: parsed.format.height,
  };
}
