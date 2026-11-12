const INLINE_CODE = /`([^`\n]+)`/gu;
const FIELD_PATH = /^[a-zA-Z_][\w-]*(\[\])?(\.[a-zA-Z_*][\w-]*(\[\])?)*$/u;
const FIELD_CONTEXT = /\b(fields?|campos?)\b|\bmanifest\b|\bbrand\.json\b/iu;

function normalize(token: string): string {
  return token.replace(/\.\*/gu, '.*');
}

function isKnown(token: string, known: ReadonlySet<string>, allowlist: ReadonlySet<string>): boolean {
  if (allowlist.has(token) || known.has(token)) return true;
  const withoutArrays = token.replace(/\[\]/gu, '');
  return [...known].some((path) => path.replace(/\[\]/gu, '') === withoutArrays || path.split('.').pop() === token);
}

export function findUnknownFieldTokens(markdown: string, known: ReadonlySet<string>, allowlist: ReadonlySet<string>): string[] {
  const unknown = new Set<string>();
  let inFence = false;
  let headingMentionsField = false;
  markdown.split('\n').forEach((line) => {
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    if (/^#{1,6}\s/u.test(line)) headingMentionsField = FIELD_CONTEXT.test(line);
    const checkAllTokens = headingMentionsField || FIELD_CONTEXT.test(line);
    for (const match of line.matchAll(INLINE_CODE)) {
      const token = normalize((match[1] ?? '').trim());
      if (!FIELD_PATH.test(token)) continue;
      const isDotPath = token.includes('.') || token.includes('[]');
      if ((checkAllTokens || isDotPath) && !isKnown(token, known, allowlist)) unknown.add(token);
    }
  });
  return [...unknown];
}
