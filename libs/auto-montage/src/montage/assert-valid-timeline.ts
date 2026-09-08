import type { Timeline } from '@video-maker/timeline-core';
import { validateTimeline } from '@video-maker/timeline-core';

import { TimelineInvalidError } from '../errors/timeline-invalid-error';

export function assertValidTimeline(timeline: Timeline): Timeline {
  const result = validateTimeline(timeline);
  if (result.ok) {
    return timeline;
  }

  throw new TimelineInvalidError({ timelineId: timeline.id, issues: result.issues });
}
