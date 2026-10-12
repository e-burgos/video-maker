import { ProductionProposalSchema } from '@video-maker/timeline-core';

import { responseShapeUnexpected } from './render-api-error';
import type { ProposalDocument } from './proposal-types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseProposalDocument(value: unknown): ProposalDocument {
  if (
    !isRecord(value) ||
    typeof value['slug'] !== 'string' ||
    typeof value['path'] !== 'string' ||
    !isRecord(value['estimates']) ||
    !isRecord(value['engine'])
  ) {
    throw responseShapeUnexpected(200, 'a production proposal document');
  }

  const raw = value['proposal'];
  if (raw === null || raw === undefined) {
    return { ...(value as unknown as ProposalDocument), proposal: null };
  }

  const parsed = ProductionProposalSchema.safeParse(raw);
  if (!parsed.success) {
    throw responseShapeUnexpected(200, 'a production proposal document');
  }

  return { ...(value as unknown as ProposalDocument), proposal: parsed.data };
}
