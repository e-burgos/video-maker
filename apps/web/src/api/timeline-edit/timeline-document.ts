import type { Timeline } from '@video-maker/timeline-core';
import { TimelineSchema } from '@video-maker/timeline-core';

export function canonicalTimelineJson(timeline: Timeline): string {
  return JSON.stringify(TimelineSchema.parse(timeline));
}

export function timelineDocumentsEqual(a: Timeline, b: Timeline): boolean {
  return canonicalTimelineJson(a) === canonicalTimelineJson(b);
}
