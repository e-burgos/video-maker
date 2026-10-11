import type { ReviewCounts, ReviewFinding, ReviewReport, ReviewSeverity, ReviewStatus } from './review-types';
import type { TranslationKey } from '../i18n/messages-en';
import type { BadgeTone } from '../components/ui/badge';

export const REVIEW_SEVERITY_ORDER: readonly ReviewSeverity[] = ['critical', 'suggestion', 'nitpick'];

export const REVIEW_SEVERITY_LABEL: Readonly<Record<ReviewSeverity, TranslationKey>> = {
  critical: 'review.severity.critical',
  suggestion: 'review.severity.suggestion',
  nitpick: 'review.severity.nitpick',
};

export const REVIEW_STATUS_LABEL: Readonly<Record<ReviewStatus, TranslationKey>> = {
  pass: 'review.status.pass',
  warn: 'review.status.warn',
  fail: 'review.status.fail',
};

export const REVIEW_STATUS_TONE: Readonly<Record<ReviewStatus, BadgeTone>> = {
  pass: 'success',
  warn: 'warning',
  fail: 'danger',
};

export function reviewCounts(report: ReviewReport): ReviewCounts {
  return {
    critical: report.findings.filter((finding) => finding.severity === 'critical').length,
    suggestion: report.findings.filter((finding) => finding.severity === 'suggestion').length,
    nitpick: report.findings.filter((finding) => finding.severity === 'nitpick').length,
  };
}

export function findingsOfSeverity(report: ReviewReport, severity: ReviewSeverity): ReviewFinding[] {
  return report.findings.filter((finding) => finding.severity === severity);
}

export function formatClock(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

export function formatFindingRange(range: NonNullable<ReviewFinding['timeRange']>): string {
  return `${formatClock(range.startSec)}–${formatClock(range.endSec)}`;
}

export function formatMetric(value: number | null, unit: string): string | null {
  return value === null ? null : `${value.toFixed(1)} ${unit}`;
}
