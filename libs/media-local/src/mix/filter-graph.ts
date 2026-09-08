export interface FilterChain {
  readonly inputLabels: readonly string[];
  readonly filters: readonly string[];
  readonly outputLabels: readonly string[];
}

export interface FilterGraph {
  readonly inputs: readonly string[];
  readonly chains: readonly FilterChain[];
  readonly outputLabel: string;
}
