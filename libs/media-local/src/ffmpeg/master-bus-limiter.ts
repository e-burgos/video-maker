import type { VoiceTarget } from '@video-maker/timeline-core';

import type { FilterGraph } from '../mix/filter-graph';
import { formatFilterNumber } from '../mix/format-filter-number';
import { gainDbToVolume } from '../mix/gain-db-to-volume';

export const MASTER_BUS_OUTPUT_LABEL = 'master';
export const MASTER_BUS_TRUE_PEAK_MARGIN_DB = 1;
export const MASTER_BUS_LIMITER_ATTACK_MS = 5;
export const MASTER_BUS_LIMITER_RELEASE_MS = 50;

export function buildTruePeakLimiterFilter(target: VoiceTarget): string {
  const limit = formatFilterNumber(gainDbToVolume(target.truePeakDbtp - MASTER_BUS_TRUE_PEAK_MARGIN_DB));
  return `alimiter=limit=${limit}:attack=${MASTER_BUS_LIMITER_ATTACK_MS}:release=${MASTER_BUS_LIMITER_RELEASE_MS}:level=disabled`;
}

export function withMasterBusLimiter(graph: FilterGraph, target: VoiceTarget): FilterGraph {
  return {
    inputs: graph.inputs,
    chains: [
      ...graph.chains,
      {
        inputLabels: [graph.outputLabel],
        filters: [buildTruePeakLimiterFilter(target)],
        outputLabels: [MASTER_BUS_OUTPUT_LABEL],
      },
    ],
    outputLabel: MASTER_BUS_OUTPUT_LABEL,
  };
}
