import type { Transcription, Word } from '../schemas/transcription.schema';

export const spanishTranscription: Transcription = {
  assetId: 'aroll-cam-01',
  engine: 'whisper.cpp',
  model: 'ggml-medium',
  language: 'es',
  words: [
    { text: 'hoy', startMs: 0, endMs: 300 },
    { text: 'te', startMs: 350, endMs: 500 },
    { text: 'muestro', startMs: 520, endMs: 900 },
    { text: 'cómo', startMs: 1200, endMs: 1550 },
    { text: 'editar', startMs: 1570, endMs: 2050 },
    { text: 'un', startMs: 2070, endMs: 2180 },
    { text: 'video', startMs: 2680, endMs: 3100 },
    { text: 'completo', startMs: 3120, endMs: 3700 },
    { text: 'sin', startMs: 3720, endMs: 3860 },
    { text: 'pagar', startMs: 4660, endMs: 5050 },
    { text: 'nada', startMs: 5070, endMs: 5400 },
    { text: 'es', startMs: 5420, endMs: 5520 },
    { text: 'totalmente', startMs: 5540, endMs: 6200 },
    { text: 'gratis', startMs: 6220, endMs: 6700 },
    { text: 'y', startMs: 6720, endMs: 6800 },
    { text: 'corre', startMs: 6820, endMs: 7150 },
    { text: 'en', startMs: 7170, endMs: 7260 },
    { text: 'tu', startMs: 7280, endMs: 7380 },
    { text: 'propia', startMs: 7400, endMs: 7800 },
    { text: 'máquina', startMs: 7820, endMs: 8400 },
  ],
  segments: [
    { startMs: 0, endMs: 3860, text: 'hoy te muestro cómo editar un video completo sin', wordRange: [0, 8] },
    { startMs: 4660, endMs: 8400, text: 'pagar nada es totalmente gratis y corre en tu propia máquina', wordRange: [9, 19] },
  ],
};

export const overlappingWords: readonly Word[] = [
  { text: 'uno', startMs: 0, endMs: 500 },
  { text: 'dos', startMs: 400, endMs: 900 },
  { text: 'tres', startMs: 900, endMs: 1200 },
];
