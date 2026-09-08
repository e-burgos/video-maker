import type { EditDecisionList } from '@video-maker/timeline-core';
import { EditDecisionListSchema } from '@video-maker/timeline-core';

import { EditDecisionListInvalidError } from '../errors/edit-decision-list-invalid-error';

export function assertValidEditDecisionList(candidate: unknown): EditDecisionList {
  const result = EditDecisionListSchema.safeParse(candidate);
  if (result.success) {
    return result.data;
  }

  const sourceAssetId =
    typeof candidate === 'object' && candidate !== null && 'sourceAssetId' in candidate
      ? String((candidate as { sourceAssetId: unknown }).sourceAssetId)
      : 'unknown';

  throw new EditDecisionListInvalidError({
    sourceAssetId,
    issues: result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
  });
}
