import {
  ENUMERATION_MIN_SEPARATORS,
  SCENE_FRAMES_MAX,
  SCENE_FRAMES_MIN_WHEN_MANY,
  SCENE_FRAME_INTERVAL_SEC,
  SCENE_SINGLE_FRAME_MAX_DURATION_SEC,
  SCENE_SINGLE_FRAME_MAX_ELEMENTS,
} from './review-thresholds';

const SENTENCE_END = /[.!?¿¡:]/u;
const ENUMERATION_SEPARATOR = /,|;|\s(?:y|o|e|u)\s/gu;
const NAMED_TOKEN = /^(?:\p{Lu}|\d)/u;

interface Token {
  readonly text: string;
  readonly startsSentence: boolean;
}

function tokenize(voice: string): Token[] {
  const tokens: Token[] = [];
  let startsSentence = true;
  for (const raw of voice.split(/\s+/u).filter((word) => word.length > 0)) {
    const text = raw.replace(/^[¿¡"'(]+|[.,;:!?"')]+$/gu, '');
    if (text.length > 0) {
      tokens.push({ text, startsSentence });
    }
    startsSentence = SENTENCE_END.test(raw.at(-1) ?? '');
  }
  return tokens;
}

function namedFlags(tokens: readonly Token[]): boolean[] {
  return tokens.map((token, position) => {
    if (!NAMED_TOKEN.test(token.text)) {
      return false;
    }
    if (!token.startsSentence) {
      return true;
    }
    const next = tokens[position + 1];
    return next !== undefined && !next.startsSentence && NAMED_TOKEN.test(next.text);
  });
}

function countNamedRuns(voice: string): number {
  const flags = namedFlags(tokenize(voice));
  return flags.filter((named, position) => named && !flags[position - 1]).length;
}

function countEnumeratedItems(voice: string): number {
  const separators = voice.match(ENUMERATION_SEPARATOR)?.length ?? 0;
  return separators >= ENUMERATION_MIN_SEPARATORS ? separators + 1 : 0;
}

export function countNamedElements(voice: string | null): number {
  if (voice === null) {
    return 0;
  }
  return Math.max(countNamedRuns(voice), countEnumeratedItems(voice));
}

export function sceneFrameCount(durationSec: number, voice: string | null): number {
  const elements = countNamedElements(voice);
  if (durationSec <= SCENE_SINGLE_FRAME_MAX_DURATION_SEC && elements <= SCENE_SINGLE_FRAME_MAX_ELEMENTS) {
    return 1;
  }
  const byDuration = Math.ceil(durationSec / SCENE_FRAME_INTERVAL_SEC);
  return Math.min(SCENE_FRAMES_MAX, Math.max(SCENE_FRAMES_MIN_WHEN_MANY, byDuration, elements));
}

export function sceneFrameTimes(startSec: number, endSec: number, voice: string | null): number[] {
  const durationSec = Math.max(0, endSec - startSec);
  const count = sceneFrameCount(durationSec, voice);
  return Array.from({ length: count }, (_, position) => startSec + (durationSec * (position + 0.5)) / count);
}
