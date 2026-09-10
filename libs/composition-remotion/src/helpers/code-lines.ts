export interface CodeLayoutOptions {
  code: string;
  baseFontSize: number;
  maxLines?: number | undefined;
  maxColumns?: number | undefined;
}

export interface CodeLayout {
  lines: readonly string[];
  fontSize: number;
  truncated: boolean;
}

const DEFAULT_MAX_LINES = 18;
const DEFAULT_MAX_COLUMNS = 52;
const MIN_FONT_SCALE = 0.55;
const TRUNCATION_MARK = '…';

export const MONOSPACE_ADVANCE_EM = 0.6;

export function columnsThatFit(availableWidth: number, fontSize: number): number {
  return Math.max(1, Math.floor(availableWidth / (fontSize * MONOSPACE_ADVANCE_EM)));
}

function splitLines(code: string): string[] {
  return code.replace(/\r\n?/gu, '\n').replace(/\t/gu, '  ').split('\n');
}

function trimTrailingBlankLines(lines: readonly string[]): string[] {
  const trimmed = [...lines];
  while (trimmed.length > 0 && (trimmed[trimmed.length - 1] ?? '').trim().length === 0) {
    trimmed.pop();
  }
  return trimmed;
}

function clipColumns(line: string, maxColumns: number): string {
  return line.length <= maxColumns ? line : `${line.slice(0, maxColumns - 1)}${TRUNCATION_MARK}`;
}

function fontScaleFor(lines: readonly string[], maxLines: number, maxColumns: number): number {
  const longestLine = lines.reduce((longest, line) => Math.max(longest, line.length), 0);
  const lineScale = lines.length <= maxLines ? 1 : maxLines / lines.length;
  const columnScale = longestLine <= maxColumns ? 1 : maxColumns / longestLine;

  return Math.max(MIN_FONT_SCALE, Math.min(1, lineScale, columnScale));
}

export function codeLayout({ code, baseFontSize, maxLines, maxColumns }: CodeLayoutOptions): CodeLayout {
  const lineBudget = maxLines ?? DEFAULT_MAX_LINES;
  const columnBudget = maxColumns ?? DEFAULT_MAX_COLUMNS;

  const allLines = trimTrailingBlankLines(splitLines(code));
  const keptLines = allLines.slice(0, lineBudget);

  const scale = fontScaleFor(allLines, lineBudget, columnBudget);
  const columnsAtScale = Math.max(1, Math.floor(columnBudget / scale));
  const clippedLines = keptLines.map((line) => clipColumns(line, columnsAtScale));

  return {
    lines: clippedLines,
    fontSize: Math.round(baseFontSize * scale),
    truncated: allLines.length > keptLines.length || keptLines.some((line) => line.length > columnsAtScale),
  };
}
