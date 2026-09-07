import type { VoiceTarget } from '@video-maker/timeline-core';

import type { LoudnessMeasurement } from './parse-loudnorm-json';

function formatTargetValue(n: number): string {
  return String(n);
}

function formatMeasuredValue(n: number): string {
  return n.toFixed(2);
}

export function buildLoudnormFilter(target: VoiceTarget, measured?: LoudnessMeasurement): string {
  const targetPart = `I=${formatTargetValue(target.integratedLufs)}:TP=${formatTargetValue(
    target.truePeakDbtp,
  )}:LRA=${formatTargetValue(target.loudnessRange)}`;

  if (measured === undefined) {
    return `loudnorm=${targetPart}:print_format=json`;
  }

  const measuredPart = [
    `measured_I=${formatMeasuredValue(measured.integratedLufs)}`,
    `measured_TP=${formatMeasuredValue(measured.truePeakDbtp)}`,
    `measured_LRA=${formatMeasuredValue(measured.loudnessRange)}`,
    `measured_thresh=${formatMeasuredValue(measured.thresholdLufs)}`,
    `offset=${formatMeasuredValue(measured.targetOffsetDb)}`,
  ].join(':');

  return `loudnorm=${targetPart}:${measuredPart}:linear=true:print_format=json`;
}
