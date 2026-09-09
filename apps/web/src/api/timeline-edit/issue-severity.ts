import type { TimelineIssueCode } from '@video-maker/timeline-core';

import { VOICE_TRACK_NOT_MIRRORED_CODE } from './aroll-layout';

export type TimelineIssueSeverity = 'save-blocking' | 'render-blocking';

export type UiIssueCode = TimelineIssueCode | typeof VOICE_TRACK_NOT_MIRRORED_CODE;

const TIMELINE_ISSUE_SEVERITY: Record<TimelineIssueCode, TimelineIssueSeverity> = {
  SCHEMA_INVALID: 'save-blocking',
  EMPTY_AROLL: 'render-blocking',
  ASSET_NOT_FOUND: 'render-blocking',
  CLIP_EXCEEDS_ASSET: 'render-blocking',
  AROLL_OVERLAP: 'render-blocking',
  AROLL_GAP: 'render-blocking',
  DURATION_MISMATCH: 'render-blocking',
  CLIP_OUT_OF_TIMELINE: 'render-blocking',
  TRANSITION_CLIP_NOT_FOUND: 'render-blocking',
  CAPTION_OUT_OF_SAFE_ZONE: 'render-blocking',
};

export function issueSeverity(code: UiIssueCode): TimelineIssueSeverity {
  if (code === VOICE_TRACK_NOT_MIRRORED_CODE) {
    return 'render-blocking';
  }

  return TIMELINE_ISSUE_SEVERITY[code];
}
