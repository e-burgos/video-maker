import { AUDIO_MIX_SAMPLE_RATE } from './audio-mix-format';
import type { FilterChain } from './filter-graph';
import { formatFilterNumber } from './format-filter-number';

export interface SfxMixCue {
  readonly path: string;
  readonly atMs: number;
  readonly gainDb: number;
  readonly durationMs: number;
  readonly fadeInMs?: number;
  readonly fadeOutMs?: number;
}

function fadeFilters(cue: SfxMixCue): string[] {
  const durationSeconds = cue.durationMs / 1000;
  const fadeIn = cue.fadeInMs === undefined || cue.fadeInMs <= 0 ? [] : [`afade=t=in:d=${formatFilterNumber(Math.min(cue.fadeInMs / 1000, durationSeconds))}`];
  if (cue.fadeOutMs === undefined || cue.fadeOutMs <= 0) {
    return fadeIn;
  }
  const fadeOutSeconds = Math.min(cue.fadeOutMs / 1000, durationSeconds);
  return [...fadeIn, `afade=t=out:st=${formatFilterNumber(durationSeconds - fadeOutSeconds)}:d=${formatFilterNumber(fadeOutSeconds)}`];
}

export function buildSfxChain(cue: SfxMixCue, inputLabel: string, outputLabel: string): FilterChain {
  return {
    inputLabels: [inputLabel],
    filters: [
      `aresample=${AUDIO_MIX_SAMPLE_RATE}`,
      'aformat=channel_layouts=stereo',
      ...fadeFilters(cue),
      `volume=${formatFilterNumber(cue.gainDb)}dB`,
      `adelay=${formatFilterNumber(cue.atMs)}:all=1`,
    ],
    outputLabels: [outputLabel],
  };
}
