import { MONTAGE_PRESETS } from '@video-maker/auto-montage';
import { describe, expect, it } from 'vitest';

import { COMMAND_NAMES, DEFAULT_SEED, PRESET_NAMES } from './preset-names';

describe('PRESET_NAMES', () => {
  it('stays in parity with MONTAGE_PRESETS from @video-maker/auto-montage', () => {
    expect([...PRESET_NAMES].sort()).toEqual(Object.keys(MONTAGE_PRESETS).sort());
  });
});

describe('COMMAND_NAMES', () => {
  it('lists the four commands in the fixed order used by usage messages', () => {
    expect(COMMAND_NAMES).toEqual(['ingest', 'plan', 'render', 'run']);
  });
});

describe('DEFAULT_SEED', () => {
  it('is zero', () => {
    expect(DEFAULT_SEED).toBe(0);
  });
});
