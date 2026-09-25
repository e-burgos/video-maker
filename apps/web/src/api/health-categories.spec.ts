import { describe, expect, it } from 'vitest';

import { dedupeHealthCategoryKeys, healthCategoryKey } from './health-categories';

describe('healthCategoryKey', () => {
  it('groups ffmpeg and ffprobe under video tools', () => {
    expect(healthCategoryKey('ffmpeg')).toBe('health.category.video');
    expect(healthCategoryKey('ffprobe')).toBe('health.category.video');
  });

  it('groups whisperCli and whisperModel under transcription', () => {
    expect(healthCategoryKey('whisperCli')).toBe('health.category.transcription');
    expect(healthCategoryKey('whisperModel')).toBe('health.category.transcription');
  });

  it('groups ttsCli and ttsVoicesDir under the voice engine', () => {
    expect(healthCategoryKey('ttsCli')).toBe('health.category.voice');
    expect(healthCategoryKey('ttsVoicesDir')).toBe('health.category.voice');
  });

  it('falls back to the generic engine category for anything else, never the raw id', () => {
    expect(healthCategoryKey('composition-remotion/render')).toBe('health.engine');
    expect(healthCategoryKey('media-local')).toBe('health.engine');
  });
});

describe('dedupeHealthCategoryKeys', () => {
  it('collapses ids that map to the same category into one entry', () => {
    expect(dedupeHealthCategoryKeys(['ttsCli', 'ttsVoicesDir'])).toEqual(['health.category.voice']);
  });

  it('keeps the first-seen order across distinct categories', () => {
    expect(dedupeHealthCategoryKeys(['composition-remotion/render', 'ffprobe', 'ffmpeg'])).toEqual([
      'health.engine',
      'health.category.video',
    ]);
  });
});
