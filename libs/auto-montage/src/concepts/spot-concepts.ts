import type { Transcription, Word } from '@video-maker/timeline-core';

import type { MontagePreset } from '../presets/montage-preset';
import type { Concept, ConceptOccurrence } from './concept';
import { normalizeTerm } from './normalize-term';
import { resolveStopwords } from './stopwords';

export interface SpotConceptsResult {
  readonly concepts: readonly Concept[];
  readonly stopwordLanguage: string | null;
}

interface DictionaryEntry {
  readonly term: string;
  readonly tokens: readonly string[];
}

interface DictionaryMatch {
  readonly term: string;
  readonly wordCount: number;
  readonly firstWord: Word;
  readonly lastWord: Word;
}

interface DictionarySweepResult {
  readonly occurrencesByTerm: ReadonlyMap<string, ConceptOccurrence[]>;
  readonly consumed: ReadonlySet<number>;
}

function tokenizeDictionaryPhrase(phrase: string): readonly string[] {
  return phrase
    .split(/\s+/)
    .map(normalizeTerm)
    .filter((token) => token.length > 0);
}

function compareAscending(left: string, right: string): number {
  return left < right ? -1 : 1;
}

function buildDictionaryEntries(dictionary: readonly string[]): readonly DictionaryEntry[] {
  return dictionary
    .map((phrase): DictionaryEntry => {
      const tokens = tokenizeDictionaryPhrase(phrase);
      return { term: tokens.join(' '), tokens };
    })
    .filter((entry) => entry.tokens.length > 0)
    .sort((left, right) => right.tokens.length - left.tokens.length || compareAscending(left.term, right.term));
}

function matchDictionaryEntryAt(
  words: readonly Word[],
  startIndex: number,
  firstWord: Word,
  entry: DictionaryEntry,
): DictionaryMatch | undefined {
  const endIndex = startIndex + entry.tokens.length - 1;
  const lastWord = words[endIndex];
  if (lastWord === undefined) {
    return undefined;
  }

  const allTokensMatch = entry.tokens.every((token, offset) => {
    const word = words[startIndex + offset];
    return word !== undefined && normalizeTerm(word.text) === token;
  });
  if (!allTokensMatch) {
    return undefined;
  }

  return { term: entry.term, wordCount: entry.tokens.length, firstWord, lastWord };
}

function findDictionaryMatch(
  words: readonly Word[],
  startIndex: number,
  firstWord: Word,
  entries: readonly DictionaryEntry[],
): DictionaryMatch | undefined {
  for (const entry of entries) {
    const match = matchDictionaryEntryAt(words, startIndex, firstWord, entry);
    if (match !== undefined) {
      return match;
    }
  }
  return undefined;
}

function pushOccurrence(
  occurrencesByTerm: Map<string, ConceptOccurrence[]>,
  term: string,
  occurrence: ConceptOccurrence,
): void {
  const occurrences = occurrencesByTerm.get(term);
  if (occurrences === undefined) {
    occurrencesByTerm.set(term, [occurrence]);
    return;
  }
  occurrences.push(occurrence);
}

function sweepDictionaryPhrases(
  words: readonly Word[],
  entries: readonly DictionaryEntry[],
): DictionarySweepResult {
  const occurrencesByTerm = new Map<string, ConceptOccurrence[]>();
  const consumed = new Set<number>();

  for (const [index, firstWord] of words.entries()) {
    if (consumed.has(index)) {
      continue;
    }

    const match = findDictionaryMatch(words, index, firstWord, entries);
    if (match === undefined) {
      continue;
    }

    pushOccurrence(occurrencesByTerm, match.term, {
      startMs: match.firstWord.startMs,
      endMs: match.lastWord.endMs,
      wordIndex: index,
      wordCount: match.wordCount,
    });

    for (let consumedIndex = index; consumedIndex < index + match.wordCount; consumedIndex += 1) {
      consumed.add(consumedIndex);
    }
  }

  return { occurrencesByTerm, consumed };
}

function collectFrequencyOccurrences(
  words: readonly Word[],
  consumed: ReadonlySet<number>,
  stopwords: ReadonlySet<string>,
  minTermLength: number,
): ReadonlyMap<string, ConceptOccurrence[]> {
  const occurrencesByTerm = new Map<string, ConceptOccurrence[]>();

  words.forEach((word, index) => {
    if (consumed.has(index)) {
      return;
    }
    const term = normalizeTerm(word.text);
    if (term.length === 0 || term.length < minTermLength || stopwords.has(term)) {
      return;
    }
    pushOccurrence(occurrencesByTerm, term, {
      startMs: word.startMs,
      endMs: word.endMs,
      wordIndex: index,
      wordCount: 1,
    });
  });

  return occurrencesByTerm;
}

function sortByStartMs(occurrences: readonly ConceptOccurrence[]): ConceptOccurrence[] {
  return [...occurrences].sort((left, right) => left.startMs - right.startMs);
}

function buildConcepts(
  dictionaryOccurrences: ReadonlyMap<string, ConceptOccurrence[]>,
  frequencyOccurrences: ReadonlyMap<string, ConceptOccurrence[]>,
  minFrequency: number,
): readonly Concept[] {
  const concepts: Concept[] = [];

  dictionaryOccurrences.forEach((occurrences, term) => {
    concepts.push({ term, source: 'dictionary', occurrences: sortByStartMs(occurrences) });
  });

  frequencyOccurrences.forEach((occurrences, term) => {
    if (occurrences.length >= minFrequency) {
      concepts.push({ term, source: 'frequency', occurrences: sortByStartMs(occurrences) });
    }
  });

  return concepts.sort((left, right) => compareAscending(left.term, right.term));
}

export function spotConcepts(transcription: Transcription, preset: MontagePreset): SpotConceptsResult {
  const { language: stopwordLanguage, terms: stopwords } = resolveStopwords(transcription.language);
  const dictionaryEntries = buildDictionaryEntries(preset.concepts.dictionary);
  const { occurrencesByTerm: dictionaryOccurrences, consumed } = sweepDictionaryPhrases(
    transcription.words,
    dictionaryEntries,
  );
  const frequencyOccurrences = collectFrequencyOccurrences(
    transcription.words,
    consumed,
    stopwords,
    preset.concepts.minTermLength,
  );

  return {
    concepts: buildConcepts(dictionaryOccurrences, frequencyOccurrences, preset.concepts.minFrequency),
    stopwordLanguage,
  };
}
