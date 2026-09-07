import type { TranscriptWord } from '../captions/group-words-for-captions';

export const sevenConsecutiveWords: readonly TranscriptWord[] = [
  { text: 'uno', startMs: 0, endMs: 200 },
  { text: 'dos', startMs: 300, endMs: 500 },
  { text: 'tres', startMs: 600, endMs: 800 },
  { text: 'cuatro', startMs: 900, endMs: 1100 },
  { text: 'cinco', startMs: 1200, endMs: 1400 },
  { text: 'seis', startMs: 1500, endMs: 1700 },
  { text: 'siete', startMs: 1800, endMs: 2000 },
];

export const isolatedWordSurroundedByLongGaps: readonly TranscriptWord[] = [
  { text: 'antes', startMs: 0, endMs: 300 },
  { text: 'solo', startMs: 900, endMs: 1200 },
  { text: 'después', startMs: 1900, endMs: 2200 },
];

export const longWordExceedingMaxDuration: readonly TranscriptWord[] = [
  { text: 'antes', startMs: 0, endMs: 300 },
  { text: 'larguísima', startMs: 900, endMs: 2400 },
  { text: 'después', startMs: 3000, endMs: 3300 },
];

export const keywordSentenceWords: readonly TranscriptWord[] = [
  { text: 'esto', startMs: 0, endMs: 300 },
  { text: 'es', startMs: 320, endMs: 420 },
  { text: '¡Gratis!', startMs: 440, endMs: 700 },
];

export const tieDurationWords: readonly TranscriptWord[] = [
  { text: 'ay', startMs: 0, endMs: 200 },
  { text: 'ey', startMs: 220, endMs: 420 },
];
