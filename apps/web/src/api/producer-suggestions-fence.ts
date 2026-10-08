const SUGGESTIONS_FENCE_PATTERN = /```suggestions[ \t]*\r?\n([\s\S]*?)```[ \t]*\r?\n?/giu;

export function stripSuggestionsFence(text: string): string {
  return text.replace(SUGGESTIONS_FENCE_PATTERN, '').trim();
}
