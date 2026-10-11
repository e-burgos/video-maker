import type { DeliveryContract } from '@video-maker/timeline-core';

import type { FindingDraft } from './review-finding-builder';
import { formatSeconds } from './review-finding-builder';
import { SHORT_MAX_DURATION_SEC } from './review-thresholds';

const CHECK = 'delivery';

export function requiresVoice(delivery: DeliveryContract): boolean {
  return delivery.requiresVoice ?? delivery.kind === 'tutorial';
}

export function requiresCaptions(delivery: DeliveryContract): boolean {
  return delivery.requiresCaptions ?? delivery.kind === 'tutorial';
}

function maxDurationSec(delivery: DeliveryContract): number | null {
  return delivery.maxDurationSec ?? (delivery.kind === 'short' ? SHORT_MAX_DURATION_SEC : null);
}

export interface DeliveryFacts {
  readonly delivery: DeliveryContract;
  readonly actualDurationSec: number;
  readonly hasVoice: boolean;
  readonly captionCount: number;
}

export function deliveryFindings(facts: DeliveryFacts): FindingDraft[] {
  const { delivery } = facts;
  const findings: FindingDraft[] = [];
  const limit = maxDurationSec(delivery);
  if (limit !== null && facts.actualDurationSec > limit) {
    findings.push({
      check: CHECK,
      severity: 'critical',
      message: `El video dura ${formatSeconds(facts.actualDurationSec)} y el contrato de entrega (${delivery.kind}) permite ${formatSeconds(limit)} como máximo.`,
      proposedFix: `Recortar el video a ${formatSeconds(limit)} o menos, o cambiar el tipo de entrega.`,
    });
  }
  if (requiresVoice(delivery) && !facts.hasVoice) {
    findings.push({
      check: CHECK,
      severity: 'critical',
      message: `El contrato de entrega (${delivery.kind}) exige voz y el video no tiene narración.`,
      proposedFix: 'Generar la voz del guion y volver a renderizar.',
    });
  }
  if (requiresCaptions(delivery) && facts.captionCount === 0) {
    findings.push({
      check: CHECK,
      severity: 'critical',
      message: `El contrato de entrega (${delivery.kind}) exige subtítulos y el video no tiene.`,
      proposedFix: 'Activar un estilo de subtítulos, generarlos y volver a renderizar.',
    });
  }
  return findings;
}
