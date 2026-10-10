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
  maxChars?: number;
  respectPhrases?: boolean;
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
const STRONG_CLAUSE_END_PATTERN = /[;:]["»)]?$/u;
const COMMA_END_PATTERN = /,["»)]?$/u;
const MIN_PHRASE_PIECE_WORDS = 3;
const CLAUSE_OPENING_WORDS = new Set([
  'que', 'y', 'e', 'o', 'u', 'pero', 'para', 'cuando', 'porque', 'como', 'donde', 'si', 'con', 'sin',
  'and', 'or', 'but', 'so', 'when', 'because', 'that', 'which', 'with', 'to',
]);
const WORDS_THAT_CANNOT_CLOSE_A_LINE = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'tu', 'tus', 'su', 'sus', 'mi',
  'mis', 'a', 'al', 'en', 'por', 'lo', 'le', 'se', 'the', 'an', 'of', 'in', 'on', 'at', 'your',
]);

enum PhraseSplitQuality {
  AfterColonOrSemicolon = 0,
  AfterComma = 1,
  BeforeClauseOpening = 2,
  BetweenContentWords = 3,
  AfterFunctionWord = 4,
}

function endsSentence(word: TranscriptWord): boolean {
  return SENTENCE_END_PATTERN.test(word.text.trim());
}

function endsWithColonOrSemicolon(word: TranscriptWord): boolean {
  return STRONG_CLAUSE_END_PATTERN.test(word.text.trim());
}

function endsWithComma(word: TranscriptWord): boolean {
  return COMMA_END_PATTERN.test(word.text.trim());
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

interface PhraseBoundaries {
  readonly maxWords: number;
  readonly maxChars: number;
  readonly maxGapMs: Ms;
  readonly forcedBreaksMs: readonly Ms[];
}

function textLength(words: readonly TranscriptWord[]): number {
  return words.reduce((total, word) => total + [...word.text.trim()].length, 0) + words.length - 1;
}

function fitsOnePhraseGroup(words: readonly TranscriptWord[], boundaries: PhraseBoundaries): boolean {
  return words.length <= boundaries.maxWords && textLength(words) <= boundaries.maxChars;
}

function endsPhraseRun(
  word: TranscriptWord,
  nextWord: TranscriptWord,
  boundaries: PhraseBoundaries,
): boolean {
  return (
    endsSentence(word) ||
    nextWord.startMs - word.endMs >= boundaries.maxGapMs ||
    crossesForcedBreak(word, nextWord, boundaries.forcedBreaksMs)
  );
}

function splitIntoPhraseRuns(
  words: readonly TranscriptWord[],
  boundaries: PhraseBoundaries,
): TranscriptWord[][] {
  const runs: TranscriptWord[][] = [];
  let current: TranscriptWord[] = [];

  words.forEach((word, index) => {
    current.push(word);
    const nextWord = words[index + 1];
    if (nextWord === undefined || endsPhraseRun(word, nextWord, boundaries)) {
      runs.push(current);
      current = [];
    }
  });

  return runs;
}

interface SplitCandidate {
  readonly index: number;
  readonly quality: PhraseSplitQuality;
  readonly piecesThatStillDoNotFit: number;
  readonly imbalance: number;
}

function phraseSplitQuality(lastWord: TranscriptWord, nextWord: TranscriptWord): PhraseSplitQuality {
  if (endsWithColonOrSemicolon(lastWord)) {
    return PhraseSplitQuality.AfterColonOrSemicolon;
  }
  if (endsWithComma(lastWord)) {
    return PhraseSplitQuality.AfterComma;
  }
  if (WORDS_THAT_CANNOT_CLOSE_A_LINE.has(normalizeWordText(lastWord.text))) {
    return PhraseSplitQuality.AfterFunctionWord;
  }
  if (CLAUSE_OPENING_WORDS.has(normalizeWordText(nextWord.text))) {
    return PhraseSplitQuality.BeforeClauseOpening;
  }
  return PhraseSplitQuality.BetweenContentWords;
}

function isBetterSplit(candidate: SplitCandidate, best: SplitCandidate | undefined): boolean {
  if (best === undefined) {
    return true;
  }
  if (candidate.quality !== best.quality) {
    return candidate.quality < best.quality;
  }
  if (candidate.piecesThatStillDoNotFit !== best.piecesThatStillDoNotFit) {
    return candidate.piecesThatStillDoNotFit < best.piecesThatStillDoNotFit;
  }
  return candidate.imbalance < best.imbalance;
}

function bestPhraseSplitIndex(words: readonly TranscriptWord[], boundaries: PhraseBoundaries): number {
  const minPieceWords = Math.max(1, Math.min(MIN_PHRASE_PIECE_WORDS, Math.floor(words.length / 2)));
  let best: SplitCandidate | undefined;

  for (let index = minPieceWords; index <= words.length - minPieceWords; index += 1) {
    const candidate: SplitCandidate = {
      index,
      quality: phraseSplitQuality(words[index - 1] as TranscriptWord, words[index] as TranscriptWord),
      piecesThatStillDoNotFit: [words.slice(0, index), words.slice(index)].filter(
        (piece) => !fitsOnePhraseGroup(piece, boundaries),
      ).length,
      imbalance: Math.abs(textLength(words.slice(0, index)) - textLength(words.slice(index))),
    };
    if (isBetterSplit(candidate, best)) {
      best = candidate;
    }
  }

  return best?.index ?? Math.ceil(words.length / 2);
}

function splitRunIntoFittingPhrases(
  words: readonly TranscriptWord[],
  boundaries: PhraseBoundaries,
): TranscriptWord[][] {
  if (words.length <= 1 || fitsOnePhraseGroup(words, boundaries)) {
    return [[...words]];
  }

  const splitIndex = bestPhraseSplitIndex(words, boundaries);
  return [
    ...splitRunIntoFittingPhrases(words.slice(0, splitIndex), boundaries),
    ...splitRunIntoFittingPhrases(words.slice(splitIndex), boundaries),
  ];
}

function toWordGroup(words: readonly TranscriptWord[]): WordGroup {
  const firstWord = words[0] as TranscriptWord;
  const lastWord = words[words.length - 1] as TranscriptWord;
  return { words: [...words], firstWord, lastWord };
}

function splitIntoPhraseGroups(
  words: readonly TranscriptWord[],
  boundaries: PhraseBoundaries,
): WordGroup[] {
  return splitIntoPhraseRuns(words, boundaries)
    .flatMap((run) => splitRunIntoFittingPhrases(run, boundaries))
    .map(toWordGroup);
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

  const groups = opts.respectPhrases
    ? splitIntoPhraseGroups(words, {
        maxWords,
        maxChars: opts.maxChars ?? Number.POSITIVE_INFINITY,
        maxGapMs,
        forcedBreaksMs,
      })
    : splitIntoGroups(words, {
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
