import type { TimelineIssueCode } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { VOICE_TRACK_NOT_MIRRORED_CODE } from './aroll-layout';
import { issueSeverity } from './issue-severity';

const ALL_TIMELINE_ISSUE_CODES: readonly TimelineIssueCode[] = [
  'SCHEMA_INVALID',
  'EMPTY_AROLL',
  'ASSET_NOT_FOUND',
  'CLIP_EXCEEDS_ASSET',
  'AROLL_OVERLAP',
  'AROLL_GAP',
  'DURATION_MISMATCH',
  'CLIP_OUT_OF_TIMELINE',
  'TRANSITION_CLIP_NOT_FOUND',
  'CAPTION_OUT_OF_SAFE_ZONE',
];

const SAVE_BLOCKING_CODES: readonly TimelineIssueCode[] = ['SCHEMA_INVALID'];

describe('issueSeverity', () => {
  it('classifies SCHEMA_INVALID as save-blocking and CLIP_EXCEEDS_ASSET as render-blocking', () => {
    expect(issueSeverity('SCHEMA_INVALID')).toBe('save-blocking');
    expect(issueSeverity('CLIP_EXCEEDS_ASSET')).toBe('render-blocking');
  });

  it('covers all ten real TimelineIssueCode values, not a sample', () => {
    expect(ALL_TIMELINE_ISSUE_CODES).toHaveLength(10);

    ALL_TIMELINE_ISSUE_CODES.forEach((code) => {
      const expected = SAVE_BLOCKING_CODES.includes(code) ? 'save-blocking' : 'render-blocking';
      expect(issueSeverity(code)).toBe(expected);
    });
  });

  it('classifies only SCHEMA_INVALID as save-blocking; every other real code is render-blocking', () => {
    const renderBlockingCodes = ALL_TIMELINE_ISSUE_CODES.filter((code) => !SAVE_BLOCKING_CODES.includes(code));

    expect(renderBlockingCodes).toHaveLength(9);
    renderBlockingCodes.forEach((code) => {
      expect(issueSeverity(code)).toBe('render-blocking');
    });
  });

  it('classifies the client-only VOICE_TRACK_NOT_MIRRORED as render-blocking without widening TimelineIssueCode', () => {
    expect(issueSeverity(VOICE_TRACK_NOT_MIRRORED_CODE)).toBe('render-blocking');
  });
});
