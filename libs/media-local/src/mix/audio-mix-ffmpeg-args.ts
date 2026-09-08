import { AUDIO_MIX_CHANNELS, AUDIO_MIX_CODEC, AUDIO_MIX_SAMPLE_RATE } from './audio-mix-format';
import type { FilterGraph } from './filter-graph';
import { serializeFilterGraph } from './serialize-filter-graph';

export function audioMixFfmpegArgs(graph: FilterGraph, outputPath: string): string[] {
  return [
    '-hide_banner',
    '-nostats',
    '-y',
    ...graph.inputs.flatMap((path) => ['-i', path]),
    '-filter_complex',
    serializeFilterGraph(graph),
    '-map',
    `[${graph.outputLabel}]`,
    '-c:a',
    AUDIO_MIX_CODEC,
    '-ar',
    String(AUDIO_MIX_SAMPLE_RATE),
    '-ac',
    String(AUDIO_MIX_CHANNELS),
    outputPath,
  ];
}
