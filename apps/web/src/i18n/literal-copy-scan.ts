export type LiteralCopyOffence = {
  kind: 'jsx-text' | 'attribute';
  text: string;
};

const COPY_ATTRIBUTES = ['placeholder', 'title', 'aria-label', 'alt'] as const;

const WORD = /[A-Za-z]{3,}/u;

const ALLOWED = new Set([
  'raw',
  'ch',
  'fps',
  'kB',
  'MB',
  'px',
]);

export function stripExpressions(source: string): string {
  let depth = 0;
  let output = '';

  for (const character of source) {
    if (character === '{') {
      depth += 1;
      continue;
    }
    if (character === '}') {
      depth = Math.max(0, depth - 1);
      output += ' ';
      continue;
    }
    if (depth === 0) {
      output += character;
    }
  }

  return output;
}

function isCopy(candidate: string): boolean {
  const trimmed = candidate.trim();
  if (trimmed === '' || !WORD.test(trimmed)) {
    return false;
  }

  return !trimmed
    .split(/[^A-Za-z]+/u)
    .filter((word) => word.length >= 3)
    .every((word) => ALLOWED.has(word));
}

export function scanLiteralCopy(source: string): LiteralCopyOffence[] {
  const offences: LiteralCopyOffence[] = [];

  for (const attribute of COPY_ATTRIBUTES) {
    const pattern = new RegExp(`\\b${attribute}\\s*=\\s*"([^"]*)"`, 'gu');
    for (const match of source.matchAll(pattern)) {
      const value = match[1] as string;
      if (isCopy(value)) {
        offences.push({ kind: 'attribute', text: `${attribute}="${value}"` });
      }
    }
  }

  const markup = stripExpressions(source);
  for (const match of markup.matchAll(/>([^<>]+)</gu)) {
    const text = (match[1] as string).replace(/\s+/gu, ' ').trim();
    if (isCopy(text)) {
      offences.push({ kind: 'jsx-text', text });
    }
  }

  return offences;
}
