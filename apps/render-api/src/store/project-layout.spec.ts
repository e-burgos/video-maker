import { describe, expect, it } from 'vitest';

import type { StorageStat } from '../deps/object-storage';
import { layoutFlagsFrom } from './project-layout';

const DIRECTORY: StorageStat = { kind: 'directory', sizeBytes: 0, modifiedAtMs: 0 };
const FILE: StorageStat = { kind: 'file', sizeBytes: 42, modifiedAtMs: 0 };

describe('layoutFlagsFrom', () => {
  it('derives the five layout flags from the stats of raw, catalog, timeline, edl and out', () => {
    expect(
      layoutFlagsFrom({ raw: DIRECTORY, catalog: FILE, timeline: FILE, edl: null, out: DIRECTORY }),
    ).toEqual({ raw: true, catalog: true, timeline: true, edl: false, out: true });

    expect(
      layoutFlagsFrom({ raw: null, catalog: null, timeline: null, edl: null, out: null }),
    ).toEqual({ raw: false, catalog: false, timeline: false, edl: false, out: false });

    expect(
      layoutFlagsFrom({ raw: FILE, catalog: DIRECTORY, timeline: null, edl: null, out: null }),
    ).toEqual({ raw: false, catalog: false, timeline: false, edl: false, out: false });
  });
});
