import type { Ms } from '@video-maker/timeline-core';

export type ConceptSource = 'dictionary' | 'frequency';

export interface ConceptOccurrence {
  readonly startMs: Ms;
  readonly endMs: Ms;
  readonly wordIndex: number;
  readonly wordCount: number;
}

export interface Concept {
  readonly term: string;
  readonly source: ConceptSource;
  readonly occurrences: readonly ConceptOccurrence[];
}
