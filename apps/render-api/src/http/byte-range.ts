export type ByteRangeResult =
  | { readonly kind: 'absent' }
  | { readonly kind: 'ignored' }
  | { readonly kind: 'satisfiable'; readonly start: number; readonly end: number }
  | { readonly kind: 'unsatisfiable' };

const RANGE_PATTERN = /^bytes=(\d*)-(\d*)$/u;

export function parseByteRange(header: string | undefined, sizeBytes: number): ByteRangeResult {
  if (header === undefined) {
    return { kind: 'absent' };
  }

  const trimmed = header.trim();
  if (trimmed.length === 0) {
    return { kind: 'ignored' };
  }

  const match = RANGE_PATTERN.exec(trimmed);
  if (match === null) {
    return { kind: 'ignored' };
  }

  const firstRaw = match[1] ?? '';
  const lastRaw = match[2] ?? '';

  if (sizeBytes === 0) {
    return { kind: 'unsatisfiable' };
  }

  if (firstRaw === '') {
    const suffixLength = Number(lastRaw);
    if (suffixLength === 0) {
      return { kind: 'unsatisfiable' };
    }
    return { kind: 'satisfiable', start: Math.max(0, sizeBytes - suffixLength), end: sizeBytes - 1 };
  }

  const start = Number(firstRaw);
  if (start >= sizeBytes) {
    return { kind: 'unsatisfiable' };
  }

  if (lastRaw === '') {
    return { kind: 'satisfiable', start, end: sizeBytes - 1 };
  }

  const last = Number(lastRaw);
  if (last < start) {
    return { kind: 'ignored' };
  }

  return { kind: 'satisfiable', start, end: Math.min(last, sizeBytes - 1) };
}
