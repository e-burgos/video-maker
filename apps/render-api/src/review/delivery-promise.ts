import { toAbsolutePath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';
import { ProductionProposalSchema } from '@video-maker/timeline-core';

import type { FindingDraft } from './review-finding-builder';
import { formatSeconds } from './review-finding-builder';
import type { DeliveryPromise, ReviewStoragePort } from './review-facts';
import { fileExists } from './review-facts';

export const PROPOSAL_PATH = 'work/producer/proposal.json';
const CHECK = 'delivery-promise';
const SHORTER_THAN_PROMISED_RATIO = 0.9;

export async function readDeliveryPromise(project: MediaProject, storage: ReviewStoragePort): Promise<DeliveryPromise | null> {
  const path = toAbsolutePath(project, PROPOSAL_PATH);
  if (!(await fileExists(storage, path))) {
    return null;
  }
  try {
    const parsed = ProductionProposalSchema.safeParse(JSON.parse(await storage.readTextFile(path)));
    if (!parsed.success || parsed.data.approvedConceptId === undefined) {
      return null;
    }
    const approvedId = parsed.data.approvedConceptId;
    const concept = parsed.data.concepts.find((candidate) => candidate.id === approvedId);
    return concept === undefined
      ? null
      : {
          conceptId: concept.id,
          title: concept.title,
          durationSec: concept.durationSec,
          maxDurationSec: concept.delivery.maxDurationSec ?? null,
        };
  } catch {
    return null;
  }
}

export function deliveryPromiseFindings(promise: DeliveryPromise | null, actualDurationSec: number): FindingDraft[] {
  if (promise === null) {
    return [];
  }
  if (promise.maxDurationSec !== null && actualDurationSec > promise.maxDurationSec) {
    return [{
      check: CHECK,
      severity: 'critical',
      message: `El render dura ${formatSeconds(actualDurationSec)} y la propuesta aprobada ("${promise.title}") prometió ${formatSeconds(promise.maxDurationSec)} como máximo.`,
      proposedFix: `Recortar escenas o acelerar el ritmo hasta ${formatSeconds(promise.maxDurationSec)} o menos, o avisar al dev y pedir que apruebe la duración real.`,
    }];
  }
  if (actualDurationSec < promise.durationSec * SHORTER_THAN_PROMISED_RATIO) {
    return [{
      check: CHECK,
      severity: 'suggestion',
      message: `El render dura ${formatSeconds(actualDurationSec)} y la propuesta aprobada ("${promise.title}") prometió ${formatSeconds(promise.durationSec)}.`,
    }];
  }
  return [];
}
