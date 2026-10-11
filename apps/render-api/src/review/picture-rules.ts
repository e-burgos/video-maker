import type { DeliveryContract } from '@video-maker/timeline-core';

import type { FindingDraft } from './review-finding-builder';
import { formatSeconds, lengthSec, overlapSec } from './review-finding-builder';
import type { SecondsRange } from './review-inputs';
import { BLACK_CRITICAL_SEC, BLACK_DETECT_MIN_SEC, FROZEN_DETECT_MIN_SEC } from './review-thresholds';

const MAJORITY = 0.5;

function mostlyInside(range: SecondsRange, containers: readonly SecondsRange[]): boolean {
  return containers.some((container) => overlapSec(range, container) > lengthSec(range) * MAJORITY);
}

export function blackFrameFindings(black: readonly SecondsRange[], bumpers: readonly SecondsRange[]): FindingDraft[] {
  return black
    .filter((range) => !mostlyInside(range, bumpers) && lengthSec(range) >= BLACK_DETECT_MIN_SEC)
    .map((range): FindingDraft => {
      const critical = lengthSec(range) >= BLACK_CRITICAL_SEC;
      return {
        check: 'black-frames',
        severity: critical ? 'critical' : 'suggestion',
        message: `Hay ${formatSeconds(lengthSec(range))} de cuadros negros fuera de los bumpers.`,
        timeRange: range,
        ...(critical ? { proposedFix: 'Recortar el tramo negro o cubrirlo con material; revisar el corte que lo produjo.' } : {}),
      };
    });
}

export function frozenFrameFindings(
  frozen: readonly SecondsRange[],
  voiceSegments: readonly SecondsRange[],
  delivery: DeliveryContract,
): FindingDraft[] {
  return frozen
    .filter((range) => lengthSec(range) >= FROZEN_DETECT_MIN_SEC)
    .map((range): FindingDraft => {
      const explained = delivery.kind === 'tutorial' && mostlyInside(range, voiceSegments);
      return {
        check: 'frozen-frames',
        severity: explained ? 'nitpick' : 'suggestion',
        message: explained
          ? `La imagen está quieta ${formatSeconds(lengthSec(range))} mientras se explica algo en voz; es normal en un tutorial.`
          : `La imagen está congelada ${formatSeconds(lengthSec(range))}.`,
        timeRange: range,
      };
    });
}
