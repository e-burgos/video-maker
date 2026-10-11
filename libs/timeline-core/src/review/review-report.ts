import { z } from 'zod';

import { DeliveryContractSchema } from '../schemas/timeline.schema';

export const REVIEW_SEVERITIES = ['critical', 'suggestion', 'nitpick'] as const;

export const ReviewSeveritySchema = z.enum(REVIEW_SEVERITIES);
export const ReviewStatusSchema = z.enum(['pass', 'warn', 'fail']);

export const ReviewTimeRangeSchema = z.strictObject({
  startSec: z.number().min(0),
  endSec: z.number().min(0),
});

export const ReviewFindingSchema = z
  .strictObject({
    id: z.string().min(1),
    check: z.string().min(1),
    severity: ReviewSeveritySchema,
    message: z.string().min(1),
    timeRange: ReviewTimeRangeSchema.optional(),
    proposedFix: z.string().min(1).optional(),
  })
  .refine((finding) => finding.severity !== 'critical' || finding.proposedFix !== undefined, {
    path: ['proposedFix'],
    message: 'Un hallazgo crítico necesita "proposedFix" con el arreglo propuesto.',
  });

export const ReviewReportSchema = z.strictObject({
  version: z.literal(1),
  file: z.string().min(1),
  createdAt: z.iso.datetime(),
  status: ReviewStatusSchema,
  delivery: DeliveryContractSchema,
  metrics: z.record(z.string(), z.number().nullable()),
  findings: z.array(ReviewFindingSchema),
});

export type ReviewSeverity = z.infer<typeof ReviewSeveritySchema>;
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;
export type ReviewFinding = z.infer<typeof ReviewFindingSchema>;
export type ReviewReport = z.infer<typeof ReviewReportSchema>;

export function reviewStatusFor(findings: readonly Pick<ReviewFinding, 'severity'>[]): ReviewStatus {
  if (findings.some((finding) => finding.severity === 'critical')) {
    return 'fail';
  }
  return findings.some((finding) => finding.severity === 'suggestion') ? 'warn' : 'pass';
}
