import type { Word } from '@video-maker/timeline-core';

import { normalizeTerm } from '../concepts/normalize-term';
import type { ScriptToken } from './script-tokens';
import { tokenizeScript } from './script-tokens';

export interface ScriptAlignmentCounts {
  readonly replaced: number;
  readonly removed: number;
  readonly inserted: number;
  readonly dropped: number;
  readonly corrected: number;
}

export interface ScriptAlignmentResult extends ScriptAlignmentCounts {
  readonly words: readonly Word[];
}

interface Match {
  readonly wordIndex: number;
  readonly scriptIndex: number;
}

interface MutableCounts {
  replaced: number;
  removed: number;
  inserted: number;
  dropped: number;
}

function longestCommonSubsequence(left: readonly string[], right: readonly string[]): Match[] {
  const rows = left.length;
  const columns = right.length;
  const lengths: number[][] = Array.from({ length: rows + 1 }, () => new Array<number>(columns + 1).fill(0));

  for (let row = rows - 1; row >= 0; row -= 1) {
    for (let column = columns - 1; column >= 0; column -= 1) {
      const current = lengths[row] as number[];
      const next = lengths[row + 1] as number[];
      current[column] =
        left[row] === right[column]
          ? (next[column + 1] as number) + 1
          : Math.max(next[column] as number, current[column + 1] as number);
    }
  }

  const matches: Match[] = [];
  let row = 0;
  let column = 0;
  while (row < rows && column < columns) {
    if (left[row] === right[column]) {
      matches.push({ wordIndex: row, scriptIndex: column });
      row += 1;
      column += 1;
      continue;
    }
    const next = lengths[row + 1] as number[];
    const current = lengths[row] as number[];
    if ((next[column] as number) >= (current[column + 1] as number)) {
      row += 1;
    } else {
      column += 1;
    }
  }

  return matches;
}

function spreadOver(tokens: readonly ScriptToken[], startMs: number, endMs: number): Word[] {
  const span = endMs - startMs;

  return tokens.map((token, index) => ({
    text: token.text,
    startMs: startMs + Math.round((span * index) / tokens.length),
    endMs: startMs + Math.round((span * (index + 1)) / tokens.length),
  }));
}

function replaceWhisperRun(
  whisperWords: readonly Word[],
  scriptTokens: readonly ScriptToken[],
  counts: MutableCounts,
): Word[] {
  const first = whisperWords[0] as Word;
  const last = whisperWords[whisperWords.length - 1] as Word;
  const endMs = Math.max(last.endMs, first.startMs + scriptTokens.length);

  counts.replaced += Math.min(whisperWords.length, scriptTokens.length);
  counts.removed += Math.max(0, whisperWords.length - scriptTokens.length);
  counts.inserted += Math.max(0, scriptTokens.length - whisperWords.length);

  return spreadOver(scriptTokens, first.startMs, endMs);
}

function fillGap(
  scriptTokens: readonly ScriptToken[],
  previousEndMs: number,
  nextStartMs: number,
  counts: MutableCounts,
): Word[] {
  if (nextStartMs - previousEndMs < scriptTokens.length) {
    counts.dropped += scriptTokens.length;
    return [];
  }

  counts.inserted += scriptTokens.length;
  return spreadOver(scriptTokens, previousEndMs, nextStartMs);
}

function resolveBlock(
  whisperWords: readonly Word[],
  scriptTokens: readonly ScriptToken[],
  previousEndMs: number,
  nextStartMs: number,
  counts: MutableCounts,
): Word[] {
  if (scriptTokens.length === 0) {
    counts.removed += whisperWords.length;
    return [];
  }

  if (whisperWords.length > 0) {
    return replaceWhisperRun(whisperWords, scriptTokens, counts);
  }

  return fillGap(scriptTokens, previousEndMs, nextStartMs, counts);
}

function unchanged(words: readonly Word[]): ScriptAlignmentResult {
  return { words: [...words], replaced: 0, removed: 0, inserted: 0, dropped: 0, corrected: 0 };
}

export function alignTranscriptToScript(
  words: readonly Word[],
  scriptText: string,
): ScriptAlignmentResult {
  const scriptTokens = tokenizeScript(scriptText);
  if (words.length === 0 || scriptTokens.length === 0) {
    return unchanged(words);
  }

  const matches = longestCommonSubsequence(
    words.map((word) => normalizeTerm(word.text)),
    scriptTokens.map((token) => token.key),
  );

  const counts: MutableCounts = { replaced: 0, removed: 0, inserted: 0, dropped: 0 };
  const aligned: Word[] = [];
  let wordCursor = 0;
  let scriptCursor = 0;

  const emitBlock = (untilWordIndex: number, untilScriptIndex: number, nextStartMs: number): void => {
    const previousEndMs = aligned[aligned.length - 1]?.endMs ?? 0;
    aligned.push(
      ...resolveBlock(
        words.slice(wordCursor, untilWordIndex),
        scriptTokens.slice(scriptCursor, untilScriptIndex),
        previousEndMs,
        nextStartMs,
        counts,
      ),
    );
  };

  for (const match of matches) {
    const matchedWord = words[match.wordIndex] as Word;
    emitBlock(match.wordIndex, match.scriptIndex, matchedWord.startMs);

    const token = scriptTokens[match.scriptIndex] as ScriptToken;
    if (token.text !== matchedWord.text) {
      counts.replaced += 1;
    }
    aligned.push({ ...matchedWord, text: token.text });

    wordCursor = match.wordIndex + 1;
    scriptCursor = match.scriptIndex + 1;
  }

  const lastWord = words[words.length - 1] as Word;
  emitBlock(words.length, scriptTokens.length, lastWord.endMs);

  return {
    words: aligned,
    replaced: counts.replaced,
    removed: counts.removed,
    inserted: counts.inserted,
    dropped: counts.dropped,
    corrected: counts.replaced + counts.removed + counts.inserted,
  };
}
