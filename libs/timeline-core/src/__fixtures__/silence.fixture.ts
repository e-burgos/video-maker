import type { SilenceRange } from '../silence/detect-silences';
import type { Transcription } from '../schemas/transcription.schema';

export const emptyTranscription: Transcription = {
  assetId: 'aroll-empty',
  engine: 'whisper.cpp',
  language: 'es',
  words: [],
  segments: [],
};

export const singleWordTranscription: Transcription = {
  assetId: 'aroll-single',
  engine: 'whisper.cpp',
  language: 'es',
  words: [{ text: 'hola', startMs: 0, endMs: 300 }],
  segments: [],
};

export const leadingSilenceTranscription: Transcription = {
  assetId: 'aroll-leading-silence',
  engine: 'whisper.cpp',
  language: 'es',
  words: [
    { text: 'después', startMs: 5000, endMs: 5300 },
    { text: 'de', startMs: 5320, endMs: 5420 },
  ],
  segments: [],
};

export const adjacentSilences: readonly SilenceRange[] = [
  { startMs: 1000, endMs: 1500 },
  { startMs: 1500, endMs: 2000 },
];

export const overlappingSilences: readonly SilenceRange[] = [
  { startMs: 1000, endMs: 1600 },
  { startMs: 1500, endMs: 2200 },
];

export const containedSilences: readonly SilenceRange[] = [
  { startMs: 1000, endMs: 2000 },
  { startMs: 1200, endMs: 1400 },
];

export const degenerateSilences: readonly SilenceRange[] = [
  { startMs: 500, endMs: 500 },
  { startMs: 900, endMs: 800 },
];
