import type { TimelineIssue } from '@video-maker/timeline-core';

import { AutoMontageError } from './auto-montage-error';

export class TimelineInvalidError extends AutoMontageError {
  readonly code = 'TIMELINE_INVALID';
  readonly timelineId: string;
  readonly issues: readonly TimelineIssue[];

  constructor(init: { timelineId: string; issues: readonly TimelineIssue[] }) {
    super(`La Timeline "${init.timelineId}" no es válida: ${init.issues.length} issue(s).`);
    this.name = 'TimelineInvalidError';
    this.timelineId = init.timelineId;
    this.issues = init.issues;
  }
}
