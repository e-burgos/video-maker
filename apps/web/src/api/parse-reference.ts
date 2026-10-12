import { ReferenceBriefSchema } from '@video-maker/timeline-core';

import { parseJob } from './parse-render-job';
import { responseShapeUnexpected } from './render-api-error';
import type { ReferenceBrief, ReferenceJob, ReferenceSummary } from './reference-types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isReferenceSummary(value: unknown): value is ReferenceSummary {
  return (
    isRecord(value) &&
    typeof value['name'] === 'string' &&
    typeof value['file'] === 'string' &&
    typeof value['briefFile'] === 'string' &&
    typeof value['durationSec'] === 'number' &&
    typeof value['scenes'] === 'number' &&
    typeof value['cutsPerMinute'] === 'number' &&
    typeof value['hasVoice'] === 'boolean' &&
    typeof value['summary'] === 'string' &&
    typeof value['createdAt'] === 'string'
  );
}

export function parseReferenceListing(value: unknown): ReferenceSummary[] {
  if (!isRecord(value) || !Array.isArray(value['references']) || !value['references'].every(isReferenceSummary)) {
    throw responseShapeUnexpected(200, 'a reference listing');
  }
  return value['references'];
}

export function parseReferenceBrief(value: unknown): ReferenceBrief {
  const parsed = ReferenceBriefSchema.safeParse(value);
  if (!parsed.success) {
    throw responseShapeUnexpected(200, 'a reference brief document');
  }
  return parsed.data;
}

export function parseReferenceJob(value: unknown): ReferenceJob {
  const job = parseJob(value);
  if (job.kind !== 'reference') {
    throw responseShapeUnexpected(200, 'a reference job document');
  }
  return job;
}
