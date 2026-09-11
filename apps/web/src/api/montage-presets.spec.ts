import { describe, expect, it } from 'vitest';

import { MONTAGE_PRESET_DETAILS, montagePresetDetail } from './montage-presets';
import { MONTAGE_PRESETS } from './render-api-types';
import { MESSAGES_EN } from '../i18n/messages-en';

describe('MONTAGE_PRESET_DETAILS', () => {
  it('names every preset of the contract, in the order of the contract', () => {
    expect(MONTAGE_PRESET_DETAILS.map((detail) => detail.name)).toEqual([...MONTAGE_PRESETS]);
  });

  it('keeps the contract id as the value and never as the label', () => {
    for (const detail of MONTAGE_PRESET_DETAILS) {
      expect(MESSAGES_EN[detail.labelKey]).not.toBe(detail.name);
      expect(MESSAGES_EN[detail.labelKey].length).toBeGreaterThan(0);
      expect(MESSAGES_EN[detail.descriptionKey].length).toBeGreaterThan(0);
    }
  });

  it('describes what each preset does with the material', () => {
    expect(MESSAGES_EN[montagePresetDetail('software-demo').descriptionKey]).toContain(
      'Screen recording',
    );
    expect(MESSAGES_EN[montagePresetDetail('hardware').descriptionKey]).toContain('photos first');
    expect(MESSAGES_EN[montagePresetDetail('educational').descriptionKey]).toContain('window');
    expect(MESSAGES_EN[montagePresetDetail('recipe').descriptionKey]).toContain(
      'one step per shot',
    );
  });
});
