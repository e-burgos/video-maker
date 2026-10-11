import type { DeliveryContract } from '@video-maker/timeline-core';

import type { ReviewMode } from './review-inputs';
import { SHORT_MAX_ASPECT_RATIO, SHORT_MAX_DURATION_SEC } from './review-thresholds';

export interface DeliveryInference {
  readonly mode: ReviewMode;
  readonly explicit: DeliveryContract | undefined;
  readonly dimensions: { readonly width: number; readonly height: number } | null;
  readonly durationSec: number;
}

function isVertical(dimensions: DeliveryInference['dimensions']): boolean {
  return dimensions !== null && dimensions.width / dimensions.height < SHORT_MAX_ASPECT_RATIO;
}

export function resolveDelivery(inference: DeliveryInference): DeliveryContract {
  if (inference.explicit !== undefined) {
    return inference.explicit;
  }
  if (inference.mode === 'motion') {
    return { kind: 'motion' };
  }
  return isVertical(inference.dimensions) && inference.durationSec <= SHORT_MAX_DURATION_SEC
    ? { kind: 'short' }
    : { kind: 'tutorial' };
}
