import type { Timeline } from '@video-maker/timeline-core';
import { TimelineSchema, timelineTotalFrames } from '@video-maker/timeline-core';

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
    durationInFrames: timelineTotalFrames(parsed),
    fps: parsed.format.fps,
    width: parsed.format.width,
    height: parsed.format.height,
  };
}
