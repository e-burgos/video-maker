import { describe, expect, it } from 'vitest';

import { parseByteRange } from './byte-range';
import type { ByteRangeResult } from './byte-range';

interface RangeCase {
  readonly name: string;
  readonly header: string | undefined;
  readonly sizeBytes: number;
  readonly expected: ByteRangeResult;
}

const CASES: readonly RangeCase[] = [
  { name: 'absent header', header: undefined, sizeBytes: 5000, expected: { kind: 'absent' } },
  {
    name: 'bytes=0-999',
    header: 'bytes=0-999',
    sizeBytes: 5000,
    expected: { kind: 'satisfiable', start: 0, end: 999 },
  },
  {
    name: 'bytes=0-999999 saturates the end to size-1',
    header: 'bytes=0-999999',
    sizeBytes: 5000,
    expected: { kind: 'satisfiable', start: 0, end: 4999 },
  },
  {
    name: 'bytes=1000- open-ended',
    header: 'bytes=1000-',
    sizeBytes: 5000,
    expected: { kind: 'satisfiable', start: 1000, end: 4999 },
  },
  {
    name: 'bytes=-500 suffix range',
    header: 'bytes=-500',
    sizeBytes: 5000,
    expected: { kind: 'satisfiable', start: 4500, end: 4999 },
  },
  {
    name: 'bytes=-99999 suffix larger than the file',
    header: 'bytes=-99999',
    sizeBytes: 5000,
    expected: { kind: 'satisfiable', start: 0, end: 4999 },
  },
  {
    name: 'bytes=5000- exactly at size is unsatisfiable',
    header: 'bytes=5000-',
    sizeBytes: 5000,
    expected: { kind: 'unsatisfiable' },
  },
  {
    name: 'bytes=9999999- beyond size is unsatisfiable',
    header: 'bytes=9999999-',
    sizeBytes: 5000,
    expected: { kind: 'unsatisfiable' },
  },
  { name: 'bytes=-0 is unsatisfiable', header: 'bytes=-0', sizeBytes: 5000, expected: { kind: 'unsatisfiable' } },
  {
    name: 'any range over a zero-byte file is unsatisfiable',
    header: 'bytes=0-10',
    sizeBytes: 0,
    expected: { kind: 'unsatisfiable' },
  },
  { name: 'bytes=abc is ignored', header: 'bytes=abc', sizeBytes: 5000, expected: { kind: 'ignored' } },
  { name: 'bytes= with nothing after the prefix is ignored', header: 'bytes=', sizeBytes: 5000, expected: { kind: 'ignored' } },
  { name: '0-999 without the bytes= prefix is ignored', header: '0-999', sizeBytes: 5000, expected: { kind: 'ignored' } },
  {
    name: 'bytes=10-5 with start greater than end is ignored',
    header: 'bytes=10-5',
    sizeBytes: 5000,
    expected: { kind: 'ignored' },
  },
  { name: 'items=0-1 with the wrong unit is ignored', header: 'items=0-1', sizeBytes: 5000, expected: { kind: 'ignored' } },
  {
    name: 'bytes=0-10,20-30 with more than one range is ignored',
    header: 'bytes=0-10,20-30',
    sizeBytes: 5000,
    expected: { kind: 'ignored' },
  },
  { name: 'header present but empty is ignored', header: '', sizeBytes: 5000, expected: { kind: 'ignored' } },
  {
    name: 'header present but only whitespace is ignored',
    header: '   ',
    sizeBytes: 5000,
    expected: { kind: 'ignored' },
  },
];

describe('parseByteRange', () => {
  it.each(CASES)('$name', ({ header, sizeBytes, expected }) => {
    expect(parseByteRange(header, sizeBytes)).toEqual(expected);
  });
});
