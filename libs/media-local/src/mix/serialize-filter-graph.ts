import type { FilterChain, FilterGraph } from './filter-graph';

function serializeFilterChain(chain: FilterChain): string {
  const inputLabels = chain.inputLabels.map((label) => `[${label}]`).join('');
  const outputLabels = chain.outputLabels.map((label) => `[${label}]`).join('');

  return `${inputLabels}${chain.filters.join(',')}${outputLabels}`;
}

export function serializeFilterGraph(graph: FilterGraph): string {
  return graph.chains.map(serializeFilterChain).join(';');
}
