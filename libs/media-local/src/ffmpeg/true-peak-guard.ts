import type { VoiceTarget } from '@video-maker/timeline-core';

export const LOUDNORM_MIN_TRUE_PEAK_DBTP = -9;
export const RETRY_TRUE_PEAK_SAFETY_DB = 0.5;

export function encoderOvershootDb(encodedTruePeakDbtp: number, plannedTruePeakDbtp: number, ceilingDbtp: number): number {
  return encodedTruePeakDbtp > ceilingDbtp ? Math.max(0, encodedTruePeakDbtp - plannedTruePeakDbtp) + RETRY_TRUE_PEAK_SAFETY_DB : 0;
}

export function targetBelowOvershoot(target: VoiceTarget, overshootDb: number): VoiceTarget {
  const lowered = Math.round((target.truePeakDbtp - overshootDb) * 100) / 100;
  return { ...target, truePeakDbtp: Math.max(LOUDNORM_MIN_TRUE_PEAK_DBTP, lowered) };
}

export interface EncodedMasterLevels {
  readonly truePeakDbtp: number;
}

export type MasterRetry = { readonly kind: 'none' } | { readonly kind: 'true-peak'; readonly target: VoiceTarget };

export function masterRetryFor(target: VoiceTarget, deliveryTarget: VoiceTarget, plannedPeakDbtp: number, encoded: EncodedMasterLevels): MasterRetry {
  const overshootDb = encoderOvershootDb(encoded.truePeakDbtp, plannedPeakDbtp, deliveryTarget.truePeakDbtp);
  return overshootDb > 0 ? { kind: 'true-peak', target: targetBelowOvershoot(target, overshootDb) } : { kind: 'none' };
}
