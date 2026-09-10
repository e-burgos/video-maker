import { describe, expect, it } from 'vitest';

import { MONTAGE_PRESET_DETAILS, montagePresetDetail } from './montage-presets';
import { MONTAGE_PRESETS } from './render-api-types';

describe('MONTAGE_PRESET_DETAILS', () => {
  it('names every preset of the contract, in the order of the contract', () => {
    expect(MONTAGE_PRESET_DETAILS.map((detail) => detail.name)).toEqual([...MONTAGE_PRESETS]);
  });

  it('keeps the contract id as the value and never as the label', () => {
    for (const detail of MONTAGE_PRESET_DETAILS) {
      expect(detail.label).not.toBe(detail.name);
      expect(detail.label.length).toBeGreaterThan(0);
      expect(detail.description.length).toBeGreaterThan(0);
    }
  });

  it('describes what each preset does with the material', () => {
    expect(montagePresetDetail('software-demo').description).toContain('Screen recording');
    expect(montagePresetDetail('hardware').description).toContain('photos first');
    expect(montagePresetDetail('educational').description).toContain('window');
    expect(montagePresetDetail('recipe').description).toContain('one step per shot');
  });
});
