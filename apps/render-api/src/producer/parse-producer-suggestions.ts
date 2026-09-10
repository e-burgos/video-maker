export const PRODUCER_SUGGESTIONS_FENCE_LANGUAGE = 'suggestions';
export const PRODUCER_MAX_SUGGESTIONS = 4;

export interface ProducerAnswer {
  readonly text: string;
  readonly suggestions: readonly string[];
}

const FENCE_PATTERN = /```suggestions[ \t]*\r?\n([\s\S]*?)```[ \t]*\r?\n?/giu;

function toSuggestionList(body: string): readonly string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body.trim());
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.replace(/\s+/gu, ' ').trim())
    .filter((entry) => entry !== '')
    .slice(0, PRODUCER_MAX_SUGGESTIONS);
}

export function parseProducerAnswer(raw: string): ProducerAnswer {
  const matches = [...raw.matchAll(FENCE_PATTERN)];
  const last = matches.at(-1);

  if (last === undefined) {
    return { text: raw.trim(), suggestions: [] };
  }

  const text = raw.replace(FENCE_PATTERN, '').trim();
  return { text, suggestions: toSuggestionList(last[1] ?? '') };
}
