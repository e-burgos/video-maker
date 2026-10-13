import type { MaterialReview, MaterialWarnings } from '@video-maker/timeline-core';

export type MaterialReviewDocument = {
  slug: string;
  path: string;
  review: MaterialReview | null;
  warnings: MaterialWarnings | null;
};
