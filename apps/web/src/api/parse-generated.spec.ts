import { describe, expect, it } from 'vitest';

import { parseGeneratedListing } from './parse-generated';

const VALID = {
  slug: 'display-ads',
  roots: ['work/voice', 'work/producer', 'out'],
  files: [{ path: 'out/display-ads.mp4', sizeBytes: 10, modifiedAtMs: 1, sample: false }],
};

describe('parseGeneratedListing', () => {
  it('acepta el documento del contrato tal cual', () => {
    expect(parseGeneratedListing(VALID)).toBe(VALID);
  });

  it('acepta un proyecto sin nada generado', () => {
    expect(parseGeneratedListing({ ...VALID, files: [] }).files).toEqual([]);
  });

  it.each([
    ['no es un objeto', []],
    ['sin slug', { ...VALID, slug: 1 }],
    ['sin roots', { ...VALID, roots: 'work/voice' }],
    ['con un root que no es texto', { ...VALID, roots: [1] }],
    ['sin files', { ...VALID, files: {} }],
    ['con un archivo sin path', { ...VALID, files: [{ sizeBytes: 1, modifiedAtMs: 1 }] }],
    ['con un tamaño que no es número', { ...VALID, files: [{ path: 'a', sizeBytes: '1', modifiedAtMs: 1 }] }],
    ['con un mtime que no es número', { ...VALID, files: [{ path: 'a', sizeBytes: 1, modifiedAtMs: null, sample: false }] }],
    ['sin la marca de muestra', { ...VALID, files: [{ path: 'a', sizeBytes: 1, modifiedAtMs: 1 }] }],
  ])('rechaza un documento %s', (_name, value) => {
    expect(() => parseGeneratedListing(value)).toThrowError(/generated listing/u);
  });
});
