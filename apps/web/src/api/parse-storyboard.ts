import type { StoryboardDocument } from '@video-maker/timeline-core';
import { StoryboardDocumentSchema } from '@video-maker/timeline-core';

import { responseShapeUnexpected } from './render-api-error';

export function parseStoryboardDocument(value: unknown): StoryboardDocument {
  const parsed = StoryboardDocumentSchema.safeParse(value);

  if (!parsed.success) {
    throw responseShapeUnexpected(
      200,
      'a storyboard document that validates against StoryboardDocumentSchema',
    );
  }

  return parsed.data;
}
