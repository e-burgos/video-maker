import type { ReviewFinding, ReviewReport, ReviewSeverity, ReviewStatus } from '@video-maker/timeline-core';

import type { RenderApiErrorPayload, RenderJobState } from './render-api-types';

export type { ReviewFinding, ReviewReport, ReviewSeverity, ReviewStatus };

export type ReviewCounts = Readonly<Record<ReviewSeverity, number>>;

export type ReviewJobReport = {
  file: string;
  reviewFile: string;
  status: ReviewStatus;
  counts: ReviewCounts;
};

export type ReviewJob = {
  id: string;
  kind: 'review';
  slug: string;
  state: RenderJobState;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  progress: { stage: string; percent: number | null } | null;
  report: ReviewJobReport | null;
  error: RenderApiErrorPayload | null;
};
