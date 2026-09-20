import { sequentialId } from '../timeline/ids';
import type { DecisionId, Ms } from '../types/units';

export interface TranscriptWord {
  text: string;
  startMs: Ms;
  endMs: Ms;
  confidence?: number;
}

export interface CaptionGroupOptions {
  minWords?: number;
  maxWords?: number;
  maxDurationMs?: Ms;
  minDurationMs?: Ms;
  maxGapMs?: Ms;
  forcedBreaksMs?: readonly Ms[];
  emphasisKeywords?: readonly string[];
}

export interface CaptionGroupPlan {
  id: DecisionId;
  startMs: Ms;
  endMs: Ms;
  words: TranscriptWord[];
  emphasisIndex: number;
}

interface WordGroup {
  words: TranscriptWord[];
  firstWord: TranscriptWord;
  lastWord: TranscriptWord;
}

const DEFAULT_MAX_WORDS = 3;
const DEFAULT_MIN_WORDS = 1;
const MIN_MAX_WORDS = 1;
const DEFAULT_MAX_DURATION_MS: Ms = 1200;
const DEFAULT_MIN_DURATION_MS: Ms = 300;
const DEFAULT_MAX_GAP_MS: Ms = 500;
const SENTENCE_END_PATTERN = /[.!?…]["»)]?$/u;

function endsSentence(word: TranscriptWord): boolean {
  return SENTENCE_END_PATTERN.test(word.text.trim());
}

function wordDurationMs(word: TranscriptWord): Ms {
  return word.endMs - word.startMs;
}

function normalizeWordText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function findKeywordMatchIndex(
  words: readonly TranscriptWord[],
  keywords: ReadonlySet<string>,
): number {
  return words.findIndex((word) => keywords.has(normalizeWordText(word.text)));
}

function findLongestWordIndex(words: readonly TranscriptWord[]): number {
  let bestIndex = -1;
  let bestDurationMs = -Infinity;

  words.forEach((word, index) => {
    const durationMs = wordDurationMs(word);
    if (durationMs >= bestDurationMs) {
      bestDurationMs = durationMs;
      bestIndex = index;
    }
  });

  return bestIndex;
}

export function pickEmphasisIndex(
  words: readonly TranscriptWord[],
  emphasisKeywords: readonly string[] = [],
): number {
  if (words.length === 0) {
    return 0;
  }

  const keywords = new Set(
    emphasisKeywords.map(normalizeWordText).filter((keyword) => keyword !== ''),
  );
  const keywordMatchIndex = keywords.size > 0 ? findKeywordMatchIndex(words, keywords) : -1;
  if (keywordMatchIndex !== -1) {
    return keywordMatchIndex;
  }

  return findLongestWordIndex(words);
}

function startGroup(word: TranscriptWord): WordGroup {
  return { words: [word], firstWord: word, lastWord: word };
}

function appendToGroup(group: WordGroup, word: TranscriptWord): WordGroup {
  return { words: [...group.words, word], firstWord: group.firstWord, lastWord: word };
}

interface GroupBoundaries {
  readonly minWords: number;
  readonly maxWords: number;
  readonly maxDurationMs: Ms;
  readonly maxGapMs: Ms;
  readonly forcedBreaksMs: readonly Ms[];
}

function crossesForcedBreak(
  previousWord: TranscriptWord,
  candidateWord: TranscriptWord,
  forcedBreaksMs: readonly Ms[],
): boolean {
  return forcedBreaksMs.some(
    (breakMs) => breakMs > previousWord.startMs && breakMs <= candidateWord.startMs,
  );
}

function shouldStartNewGroup(
  current: WordGroup,
  candidateWord: TranscriptWord,
  boundaries: GroupBoundaries,
): boolean {
  const gapMs = candidateWord.startMs - current.lastWord.endMs;
  const candidateDurationMs = candidateWord.endMs - current.firstWord.startMs;

  if (
    current.words.length >= boundaries.maxWords ||
    candidateDurationMs > boundaries.maxDurationMs ||
    gapMs >= boundaries.maxGapMs ||
    crossesForcedBreak(current.lastWord, candidateWord, boundaries.forcedBreaksMs)
  ) {
    return true;
  }

  return current.words.length >= boundaries.minWords && endsSentence(current.lastWord);
}

function splitIntoGroups(
  words: readonly TranscriptWord[],
  boundaries: GroupBoundaries,
): WordGroup[] {
  const groups: WordGroup[] = [];
  let current: WordGroup | undefined;

  for (const word of words) {
    if (current === undefined) {
      current = startGroup(word);
      continue;
    }

    if (shouldStartNewGroup(current, word, boundaries)) {
      groups.push(current);
      current = startGroup(word);
    } else {
      current = appendToGroup(current, word);
    }
  }

  if (current !== undefined) {
    groups.push(current);
  }

  return groups;
}

function extendedEndMs(group: WordGroup, nextGroup: WordGroup | undefined, minDurationMs: Ms): Ms {
  const naturalEndMs = group.lastWord.endMs;
  if (naturalEndMs - group.firstWord.startMs >= minDurationMs) {
    return naturalEndMs;
  }

  const wantedEndMs = group.firstWord.startMs + minDurationMs;
  return nextGroup !== undefined ? Math.min(wantedEndMs, nextGroup.firstWord.startMs) : wantedEndMs;
}

export function groupWordsForCaptions(
  words: readonly TranscriptWord[],
  opts: CaptionGroupOptions = {},
): CaptionGroupPlan[] {
  const maxWords = Math.max(MIN_MAX_WORDS, opts.maxWords ?? DEFAULT_MAX_WORDS);
  const maxDurationMs = opts.maxDurationMs ?? DEFAULT_MAX_DURATION_MS;
  const minDurationMs = opts.minDurationMs ?? DEFAULT_MIN_DURATION_MS;
  const maxGapMs = opts.maxGapMs ?? DEFAULT_MAX_GAP_MS;
  const minWords = Math.min(maxWords, Math.max(MIN_MAX_WORDS, opts.minWords ?? DEFAULT_MIN_WORDS));
  const emphasisKeywords = opts.emphasisKeywords ?? [];

  const forcedBreaksMs = opts.forcedBreaksMs ?? [];

  const groups = splitIntoGroups(words, {
    minWords,
    maxWords,
    maxDurationMs,
    maxGapMs,
    forcedBreaksMs,
  });

  return groups.map((group, index) => ({
    id: sequentialId('cap', index),
    startMs: group.firstWord.startMs,
    endMs: extendedEndMs(group, groups[index + 1], minDurationMs),
    words: group.words,
    emphasisIndex: pickEmphasisIndex(group.words, emphasisKeywords),
  }));
}
