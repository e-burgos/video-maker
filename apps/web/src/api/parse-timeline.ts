import type { Timeline } from '@video-maker/timeline-core';
import { TimelineSchema } from '@video-maker/timeline-core';

import { responseShapeUnexpected } from './render-api-error';

export function parseTimelineDocument(value: unknown): Timeline {
  const parsed = TimelineSchema.safeParse(value);

  if (!parsed.success) {
    throw responseShapeUnexpected(200, 'a timeline document that validates against TimelineSchema');
  }

  return parsed.data;
}
