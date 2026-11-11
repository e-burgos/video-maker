import { basename } from 'node:path';

const SPANISH_PHONETIC_RESPELLINGS: readonly (readonly [RegExp, string])[] = [[/\bdisplay\b/giu, 'Díspley']];

export function isSpanishPiperModel(modelPath: string): boolean {
  return basename(modelPath).toLowerCase().startsWith('es_');
}

export function respellForSpanishPiper(narration: string): string {
  return SPANISH_PHONETIC_RESPELLINGS.reduce(
    (text, [pattern, respelling]) => text.replace(pattern, respelling),
    narration,
  );
}
