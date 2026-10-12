import { MaterialReviewSchema, MaterialWarningsSchema } from '@video-maker/timeline-core';

import type { MaterialReviewDocument } from './material-review-types';
import { responseShapeUnexpected } from './render-api-error';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseMaterialReviewDocument(value: unknown): MaterialReviewDocument {
  if (!isRecord(value) || typeof value['slug'] !== 'string' || typeof value['path'] !== 'string') {
    throw responseShapeUnexpected(200, 'a material review document');
  }

  const review = value['review'] ?? null;
  const warnings = value['warnings'] ?? null;
  const parsedReview = review === null ? null : MaterialReviewSchema.safeParse(review);
  const parsedWarnings = warnings === null ? null : MaterialWarningsSchema.safeParse(warnings);
  if ((parsedReview !== null && !parsedReview.success) || (parsedWarnings !== null && !parsedWarnings.success)) {
    throw responseShapeUnexpected(200, 'a material review document');
  }

  return {
    slug: value['slug'],
    path: value['path'],
    review: parsedReview?.success ? parsedReview.data : null,
    warnings: parsedWarnings?.success ? parsedWarnings.data : null,
  };
}
