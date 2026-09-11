import { describe, expect, it } from 'vitest';

import { OUTPUT_PRESETS, OUTPUT_PRESET_DETAILS, outputPresetDetail } from './output-presets';
import { MESSAGES_EN } from '../i18n/messages-en';
import { MESSAGES_ES } from '../i18n/messages-es';

describe('output preset details', () => {
  it('describes every preset the timeline accepts, in the order the selector offers them', () => {
    expect(OUTPUT_PRESET_DETAILS.map((detail) => detail.name)).toEqual([...OUTPUT_PRESETS]);
  });

  it('gives every preset a readable name in both languages, never the raw id', () => {
    for (const detail of OUTPUT_PRESET_DETAILS) {
      expect(MESSAGES_EN[detail.labelKey]).not.toBe(detail.name);
      expect(MESSAGES_ES[detail.labelKey]).not.toBe(detail.name);
      expect(MESSAGES_EN[detail.descriptionKey].length).toBeGreaterThan(20);
      expect(MESSAGES_ES[detail.descriptionKey].length).toBeGreaterThan(20);
    }
  });

  it('keeps the aspect ratio in the name, so the id and the label agree', () => {
    expect(MESSAGES_EN[outputPresetDetail('youtube-16x9').labelKey]).toContain('16:9');
    expect(MESSAGES_EN[outputPresetDetail('reels-9x16').labelKey]).toContain('9:16');
  });
});
