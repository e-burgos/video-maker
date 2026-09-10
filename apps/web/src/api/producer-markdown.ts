export type ProducerInline = {
  kind: 'text' | 'bold' | 'code';
  text: string;
};

export type ProducerTableRow = ProducerInline[][];

export type ProducerBlock =
  | { kind: 'paragraph'; inlines: ProducerInline[] }
  | { kind: 'bullets'; items: ProducerInline[][] }
  | { kind: 'numbers'; items: ProducerInline[][] }
  | { kind: 'heading'; level: number; inlines: ProducerInline[] }
  | { kind: 'rule' }
  | { kind: 'code'; language: string | null; text: string }
  | { kind: 'table'; header: ProducerTableRow; rows: ProducerTableRow[] };

const BULLET_PATTERN = /^\s*[-*]\s+(.*)$/u;
const NUMBER_PATTERN = /^\s*\d{1,2}[.)]\s+(.*)$/u;
const INLINE_PATTERN = /\*\*([^*]+)\*\*|`([^`]+)`/gu;
const HEADING_PATTERN = /^\s{0,3}(#{1,6})\s+(.*)$/u;
const RULE_PATTERN = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/u;
const FENCE_PATTERN = /^\s*```\s*([A-Za-z0-9+-]*)\s*$/u;
const TABLE_SEPARATOR_PATTERN = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/u;

const MAX_QUICK_REPLY_CHARS = 120;
const MIN_QUICK_REPLIES = 2;

export function parseInlines(line: string): ProducerInline[] {
  const inlines: ProducerInline[] = [];
  let cursor = 0;

  for (const match of line.matchAll(INLINE_PATTERN)) {
    const start = match.index;
    if (start > cursor) {
      inlines.push({ kind: 'text', text: line.slice(cursor, start) });
    }
    inlines.push(
      match[1] === undefined
        ? { kind: 'code', text: match[2] as string }
        : { kind: 'bold', text: match[1] },
    );
    cursor = start + match[0].length;
  }

  if (cursor < line.length) {
    inlines.push({ kind: 'text', text: line.slice(cursor) });
  }

  return inlines;
}

export function inlinesToPlainText(inlines: readonly ProducerInline[]): string {
  return inlines.map((inline) => inline.text).join('');
}

type ListKind = 'bullets' | 'numbers';

function listItemOf(line: string): { kind: ListKind; content: string } | null {
  const bullet = BULLET_PATTERN.exec(line);
  if (bullet !== null) {
    return { kind: 'bullets', content: bullet[1] as string };
  }

  const numbered = NUMBER_PATTERN.exec(line);
  if (numbered !== null) {
    return { kind: 'numbers', content: numbered[1] as string };
  }

  return null;
}

function isTableRow(line: string): boolean {
  return line.includes('|') && line.trim() !== '';
}

export function parseTableCells(line: string): ProducerTableRow {
  const trimmed = line.trim().replace(/^\|/u, '').replace(/\|$/u, '');
  return trimmed.split('|').map((cell) => parseInlines(cell.trim()));
}

export function parseProducerMarkdown(text: string): ProducerBlock[] {
  const blocks: ProducerBlock[] = [];
  const lines = text.split('\n');

  let paragraph: string[] = [];
  let list: { kind: ListKind; items: ProducerInline[][] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: 'paragraph', inlines: parseInlines(paragraph.join(' ')) });
      paragraph = [];
    }
  };

  const flushList = () => {
    if (list !== null) {
      blocks.push({ kind: list.kind, items: list.items });
      list = null;
    }
  };

  const flushAll = () => {
    flushParagraph();
    flushList();
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] as string;

    const fence = FENCE_PATTERN.exec(line);
    if (fence !== null) {
      flushAll();
      const body: string[] = [];
      index += 1;
      while (index < lines.length && FENCE_PATTERN.exec(lines[index] as string) === null) {
        body.push(lines[index] as string);
        index += 1;
      }
      const language = fence[1] === undefined || fence[1] === '' ? null : fence[1];
      blocks.push({ kind: 'code', language, text: body.join('\n') });
      continue;
    }

    const heading = HEADING_PATTERN.exec(line);
    if (heading !== null) {
      flushAll();
      blocks.push({
        kind: 'heading',
        level: (heading[1] as string).length,
        inlines: parseInlines((heading[2] as string).trim()),
      });
      continue;
    }

    if (RULE_PATTERN.test(line)) {
      flushAll();
      blocks.push({ kind: 'rule' });
      continue;
    }

    const next = lines[index + 1];
    if (
      isTableRow(line) &&
      next !== undefined &&
      TABLE_SEPARATOR_PATTERN.test(next) &&
      next.includes('-')
    ) {
      flushAll();
      const header = parseTableCells(line);
      const rows: ProducerTableRow[] = [];
      index += 2;
      while (index < lines.length && isTableRow(lines[index] as string)) {
        rows.push(parseTableCells(lines[index] as string));
        index += 1;
      }
      index -= 1;
      blocks.push({ kind: 'table', header, rows });
      continue;
    }

    if (line.trim() === '') {
      flushAll();
      continue;
    }

    const item = listItemOf(line);
    if (item === null) {
      flushList();
      paragraph.push(line.trim());
      continue;
    }

    flushParagraph();
    if (list === null || list.kind !== item.kind) {
      flushList();
      list = { kind: item.kind, items: [] };
    }
    list.items.push(parseInlines(item.content));
  }

  flushAll();

  return blocks;
}

export function numberedOptions(text: string): string[] {
  const numbered = parseProducerMarkdown(text)
    .filter((block) => block.kind === 'numbers')
    .flatMap((block) => block.items)
    .map((item) => inlinesToPlainText(item).trim())
    .filter((option) => option.length > 0);

  return numbered.length >= MIN_QUICK_REPLIES
    ? numbered.filter((option) => option.length <= MAX_QUICK_REPLY_CHARS)
    : [];
}
