import { describe, expect, it } from 'vitest';

import { GUIDE_EN } from './guide-content-en';
import { GUIDE_ES } from './guide-content-es';
import { loadGuideContent } from './guide-content';
import { MONTAGE_PRESETS } from '../api/render-api-types';
import { OUTPUT_PRESETS } from '../api/output-presets';
import { ASSET_ROLES } from '../api/render-api-types';
import { MESSAGES_EN } from '../i18n/messages-en';
import { MESSAGES_ES } from '../i18n/messages-es';
import { parseProducerMarkdown } from '../api/producer-markdown';

const REQUIRED_SECTIONS = [
  'projects',
  'library',
  'producer',
  'storyboard',
  'voice',
  'preview',
  'presets',
  'flows',
];

describe('guide content', () => {
  it('explains every section of the studio, in the order of the flow', () => {
    expect(GUIDE_EN.sections.map((section) => section.id)).toEqual(REQUIRED_SECTIONS);
  });

  it('has the very same structure in both languages', () => {
    expect(GUIDE_ES.sections.map((section) => section.id)).toEqual(
      GUIDE_EN.sections.map((section) => section.id),
    );
  });

  it('is written, not stubbed, in both languages', () => {
    for (const guide of [GUIDE_EN, GUIDE_ES]) {
      expect(guide.title.length).toBeGreaterThan(10);
      expect(guide.intro.length).toBeGreaterThan(80);
      for (const section of guide.sections) {
        expect(section.title.length).toBeGreaterThan(10);
        expect(section.body.length).toBeGreaterThan(300);
      }
    }
  });

  it('is actually translated and never the english text copied over', () => {
    for (const [index, section] of GUIDE_EN.sections.entries()) {
      expect(GUIDE_ES.sections[index]?.title).not.toBe(section.title);
      expect(GUIDE_ES.sections[index]?.body).not.toBe(section.body);
    }
  });

  it('names every upload role with the directory it writes into', () => {
    for (const role of ASSET_ROLES) {
      expect(GUIDE_EN.sections[1]?.body).toContain(`raw/${role}/`);
      expect(GUIDE_ES.sections[1]?.body).toContain(`raw/${role}/`);
    }
  });

  it('tabulates every output preset with its id and its readable name', () => {
    const english = GUIDE_EN.sections[6]?.body ?? '';
    const spanish = GUIDE_ES.sections[6]?.body ?? '';

    for (const preset of OUTPUT_PRESETS) {
      expect(english).toContain(`\`${preset}\``);
      expect(spanish).toContain(`\`${preset}\``);
      expect(english).toContain(MESSAGES_EN[`outputPreset.${preset}.label`]);
      expect(spanish).toContain(MESSAGES_ES[`outputPreset.${preset}.label`]);
    }
  });

  it('tabulates every montage preset with its id and its readable name', () => {
    const english = GUIDE_EN.sections[1]?.body ?? '';
    const spanish = GUIDE_ES.sections[1]?.body ?? '';

    for (const preset of MONTAGE_PRESETS) {
      expect(english).toContain(`\`${preset}\``);
      expect(spanish).toContain(`\`${preset}\``);
      expect(english).toContain(MESSAGES_EN[`montagePreset.${preset}.label`]);
      expect(spanish).toContain(MESSAGES_ES[`montagePreset.${preset}.label`]);
    }
  });

  it('describes the three flows the dev asked for, in both languages', () => {
    expect(parseProducerMarkdown(GUIDE_EN.sections[7]?.body ?? '')).toHaveLength(3);
    expect(parseProducerMarkdown(GUIDE_ES.sections[7]?.body ?? '')).toHaveLength(3);
  });

  it('renders with the markdown the producer already speaks, tables included', () => {
    const blocks = parseProducerMarkdown(GUIDE_EN.sections[1]?.body ?? '');

    expect(blocks.filter((block) => block.kind === 'table')).toHaveLength(2);
  });
});

describe('loadGuideContent', () => {
  it('loads each language lazily, out of the initial chunk', async () => {
    expect(await loadGuideContent('en')).toBe(GUIDE_EN);
    expect(await loadGuideContent('es')).toBe(GUIDE_ES);
  });
});
