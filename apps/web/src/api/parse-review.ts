import { ReviewReportSchema } from '@video-maker/timeline-core';

import { responseShapeUnexpected } from './render-api-error';
import { parseJob } from './parse-render-job';
import type { ReviewJob, ReviewReport } from './review-types';

export function parseReviewReport(value: unknown): ReviewReport {
  const parsed = ReviewReportSchema.safeParse(value);
  if (!parsed.success) {
    throw responseShapeUnexpected(200, 'a render review document');
  }
  return parsed.data;
}

export function parseReviewJob(value: unknown): ReviewJob {
  const job = parseJob(value);
  if (job.kind !== 'review') {
    throw responseShapeUnexpected(200, 'a review job document');
  }
  return job;
}
