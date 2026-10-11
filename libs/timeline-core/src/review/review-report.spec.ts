import { describe, expect, it } from 'vitest';

import { ReviewFindingSchema, ReviewReportSchema, reviewStatusFor } from './review-report';

const CRITICAL = {
  id: 'f1',
  check: 'voice-music-margin',
  severity: 'critical',
  message: 'La música tapa la voz.',
  timeRange: { startSec: 1, endSec: 4 },
  proposedFix: 'Bajar la música 6 dB.',
} as const;

describe('ReviewFindingSchema', () => {
  it('accepts a critical finding with a proposed fix', () => {
    expect(ReviewFindingSchema.safeParse(CRITICAL).success).toBe(true);
  });

  it('rejects a critical finding without a proposed fix', () => {
    const { proposedFix: _omitted, ...withoutFix } = CRITICAL;

    expect(ReviewFindingSchema.safeParse(withoutFix).success).toBe(false);
  });

  it('accepts a suggestion without a proposed fix', () => {
    const { proposedFix: _omitted, ...suggestion } = CRITICAL;

    expect(ReviewFindingSchema.safeParse({ ...suggestion, severity: 'suggestion' }).success).toBe(true);
  });

  it('rejects unknown keys', () => {
    expect(ReviewFindingSchema.safeParse({ ...CRITICAL, extra: 1 }).success).toBe(false);
  });
});

describe('reviewStatusFor', () => {
  it('fails with any critical finding', () => {
    expect(reviewStatusFor([{ severity: 'nitpick' }, { severity: 'critical' }])).toBe('fail');
  });

  it('warns with suggestions and no critical', () => {
    expect(reviewStatusFor([{ severity: 'suggestion' }, { severity: 'nitpick' }])).toBe('warn');
  });

  it('passes with only nitpicks or no findings', () => {
    expect(reviewStatusFor([{ severity: 'nitpick' }])).toBe('pass');
    expect(reviewStatusFor([])).toBe('pass');
  });
});

describe('ReviewReportSchema', () => {
  const report = {
    version: 1,
    file: 'out/video.mp4',
    createdAt: '2026-10-11T12:00:00.000Z',
    status: 'fail',
    delivery: { kind: 'short', maxDurationSec: 180 },
    metrics: { integratedLufs: -14.2, truePeakDbtp: null },
    findings: [CRITICAL],
  };

  it('accepts a complete report', () => {
    expect(ReviewReportSchema.safeParse(report).success).toBe(true);
  });

  it('rejects a report with an unknown delivery kind', () => {
    expect(ReviewReportSchema.safeParse({ ...report, delivery: { kind: 'podcast' } }).success).toBe(false);
  });
});
