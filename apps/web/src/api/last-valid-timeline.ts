import { TimelineSchema } from '@video-maker/timeline-core';
import type { Timeline } from '@video-maker/timeline-core';

export function lastValidTimeline(previous: Timeline | null, next: Timeline): Timeline | null {
  return TimelineSchema.safeParse(next).success ? next : previous;
}
