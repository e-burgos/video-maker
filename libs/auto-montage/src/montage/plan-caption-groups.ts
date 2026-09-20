import type {
  CaptionGroupDecision,
  CaptionStyleGrouping,
  KeepRange,
  Word,
} from '@video-maker/timeline-core';
import { groupWordsForCaptions } from '@video-maker/timeline-core';

import type { Concept } from '../concepts/concept';
import type { MontagePreset } from '../presets/montage-preset';
import type { ScriptLineWindow } from '../transcript/align-transcript-to-script-lines';
import { findEnclosingKeep } from './keep-window';

type CaptionGroupWord = CaptionGroupDecision['words'][number];

function sequentialId(prefix: string, index: number): string {
  return `${prefix}-${String(index + 1).padStart(4, '0')}`;
}

function toCaptionGroupWord(word: { text: string; startMs: number; endMs: number }): CaptionGroupWord {
  return { text: word.text, startMs: word.startMs, endMs: word.endMs };
}

function emphasisKeywordsFor(concepts: readonly Concept[]): readonly string[] {
  const dictionaryTerms = concepts
    .filter((concept) => concept.source === 'dictionary')
    .map((concept) => concept.term);
  const frequencyTerms = concepts
    .filter((concept) => concept.source === 'frequency')
    .map((concept) => concept.term);
  return [...dictionaryTerms, ...frequencyTerms];
}

function wordsExtentMs(words: readonly { startMs: number; endMs: number }[]): {
  startMs: number;
  endMs: number;
} {
  return {
    startMs: Math.min(...words.map((word) => word.startMs)),
    endMs: Math.max(...words.map((word) => word.endMs)),
  };
}

function lineEndMsFor(lineWindows: readonly ScriptLineWindow[], startMs: number): number {
  const enclosing = lineWindows.find(
    (window) => window.startMs <= startMs && startMs < window.endMs,
  );
  return enclosing === undefined ? Number.POSITIVE_INFINITY : enclosing.endMs;
}

export function planCaptionGroups(
  words: readonly Word[],
  keeps: readonly KeepRange[],
  concepts: readonly Concept[],
  preset: MontagePreset,
  grouping: CaptionStyleGrouping | null = null,
  lineWindows: readonly ScriptLineWindow[] = [],
): readonly CaptionGroupDecision[] {
  const transcriptWords = words.map(toCaptionGroupWord);
  const groups = groupWordsForCaptions(transcriptWords, {
    maxWords: grouping?.maxWords ?? preset.captions.maxWords,
    maxDurationMs: grouping?.maxDurationMs ?? preset.captions.maxDurationMs,
    minDurationMs: grouping?.minDurationMs ?? preset.captions.minDurationMs,
    maxGapMs: grouping?.maxGapMs ?? preset.captions.maxGapMs,
    ...(grouping === null ? {} : { minWords: grouping.minWords }),
    forcedBreaksMs: lineWindows.map((window) => window.startMs),
    emphasisKeywords: emphasisKeywordsFor(concepts),
  });

  const decisions: CaptionGroupDecision[] = [];

  for (const group of groups) {
    const wordExtent = wordsExtentMs(group.words);
    const enclosingKeep = findEnclosingKeep(keeps, wordExtent.startMs, wordExtent.endMs);
    if (enclosingKeep === undefined) {
      continue;
    }

    const clampedEndMs = Math.min(
      group.endMs,
      enclosingKeep.endMs,
      lineEndMsFor(lineWindows, group.startMs),
    );
    if (clampedEndMs <= group.startMs) {
      continue;
    }

    decisions.push({
      id: sequentialId('cap', decisions.length),
      type: 'caption-group',
      startMs: group.startMs,
      endMs: clampedEndMs,
      words: group.words.map(toCaptionGroupWord),
      emphasisIndex: group.emphasisIndex,
    });
  }

  return decisions;
}
