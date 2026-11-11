import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import shippedBank from '../../assets/sfx-bank/sfx-bank.json';
import { parseSfxBank, pickSfxVariant, SFX_KINDS, sfxOfKind } from './sfx-bank';

const BANK_DIRECTORY = join(__dirname, '../../assets/sfx-bank');

describe('shipped sfx bank', () => {
  const bank = parseSfxBank(shippedBank);

  it('covers every kind with at least two variants, all files on disk', () => {
    for (const kind of SFX_KINDS) expect(sfxOfKind(bank, kind).length).toBeGreaterThanOrEqual(2);
    for (const entry of bank.sfx) expect(existsSync(join(BANK_DIRECTORY, entry.file))).toBe(true);
  });

  it('only ships licenses that allow redistributing the files and keeps every peak under -1 dBTP', () => {
    expect(bank.sfx.every((entry) => entry.license === 'CC0' || /^CC BY \d/u.test(entry.license))).toBe(true);
    expect(bank.sfx.every((entry) => entry.truePeakDbtp <= -2)).toBe(true);
  });

  it('records where each effect peaks: impacts hit at once, the build-up risers crest at their end and riser-2 hits mid-file', () => {
    const peakOf = (id: string) => bank.sfx.find((entry) => entry.id === id);
    for (const entry of sfxOfKind(bank, 'impact')) expect(entry.peakMs).toBeLessThan(150);
    for (const id of ['riser-1', 'riser-3']) expect((peakOf(id)?.durationMs ?? 0) - (peakOf(id)?.peakMs ?? 0)).toBeLessThan(250);
    expect((peakOf('riser-2')?.durationMs ?? 0) - (peakOf('riser-2')?.peakMs ?? 0)).toBeGreaterThan(700);
  });
});

describe('parseSfxBank', () => {
  const entry = { id: 'whoosh-1', kind: 'whoosh', file: 'whoosh-1.mp3', title: 'w', author: 'a', license: 'CC0', sourceUrl: 'https://freesound.org/s/1', durationMs: 500, peakMs: 200, momentaryMaxLufs: -18, truePeakDbtp: -3 };

  it('rejects share-alike, no-derivatives and non-commercial licenses', () => {
    for (const license of ['CC BY-SA 4.0', 'CC BY-ND 4.0', 'CC BY-NC 4.0', 'Pixabay Content License']) {
      expect(() => parseSfxBank({ version: 1, referenceMomentaryLufs: -18, sfx: [{ ...entry, license }] })).toThrow('only CC0, CC BY or Public Domain Mark');
    }
  });

  it('rejects a crest past the end of the effect', () => {
    expect(() => parseSfxBank({ version: 1, referenceMomentaryLufs: -18, sfx: [{ ...entry, peakMs: 600 }] })).toThrow('past the end of the effect');
  });

  it('rejects duplicated ids', () => {
    expect(() => parseSfxBank({ version: 1, referenceMomentaryLufs: -18, sfx: [entry, entry] })).toThrow('duplicated sfx id');
  });
});

describe('pickSfxVariant', () => {
  const bank = parseSfxBank(shippedBank);

  it('is deterministic for a video and avoids the variants used just before', () => {
    const first = pickSfxVariant(bank, 'whoosh', 'video-a');
    expect(pickSfxVariant(bank, 'whoosh', 'video-a')).toEqual(first);
    expect(pickSfxVariant(bank, 'whoosh', 'video-a', [first.id]).id).not.toBe(first.id);
    expect(pickSfxVariant(bank, 'whoosh', 'video-a').kind).toBe('whoosh');
  });
});
