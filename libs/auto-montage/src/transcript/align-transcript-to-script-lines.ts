import type { Word } from '@video-maker/timeline-core';

import type { ScriptAlignmentResult } from './align-transcript-to-script';
import { alignTranscriptToScript } from './align-transcript-to-script';

export interface ScriptLineWindow {
  readonly startMs: number;
  readonly endMs: number;
}

function windowIndexFor(windows: readonly ScriptLineWindow[], word: Word): number {
  let index = 0;
  while (index + 1 < windows.length && (windows[index + 1] as ScriptLineWindow).startMs <= word.startMs) {
    index += 1;
  }
  return index;
}

function partitionByWindow(
  words: readonly Word[],
  windows: readonly ScriptLineWindow[],
): Word[][] {
  const partitions: Word[][] = windows.map(() => []);

  for (const word of words) {
    (partitions[windowIndexFor(windows, word)] as Word[]).push(word);
  }

  return partitions;
}

export function alignTranscriptToScriptLines(
  words: readonly Word[],
  scriptLines: readonly string[],
  windows: readonly ScriptLineWindow[],
): ScriptAlignmentResult {
  const partitions = partitionByWindow(words, windows);
  const aligned: Word[] = [];
  const totals = { replaced: 0, removed: 0, inserted: 0, dropped: 0, corrected: 0 };

  partitions.forEach((partition, index) => {
    const result = alignTranscriptToScript(partition, scriptLines[index] ?? '');
    aligned.push(...result.words);
    totals.replaced += result.replaced;
    totals.removed += result.removed;
    totals.inserted += result.inserted;
    totals.dropped += result.dropped;
    totals.corrected += result.corrected;
  });

  return { words: aligned, ...totals };
}
