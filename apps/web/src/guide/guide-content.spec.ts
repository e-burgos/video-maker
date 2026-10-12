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

function sectionById(guide: typeof GUIDE_EN, id: string) {
  return guide.sections.find((section) => section.id === id);
}

const REQUIRED_SECTIONS = [
  'projects',
  'motion',
  'brands',
  'library',
  'producer',
  'storyboard',
  'voice',
  'preview',
  'presets',
  'youtube',
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

  it('names every upload role with the real directory it writes into (image -> images)', () => {
    const RAW_DIRECTORY_BY_ROLE: Readonly<Record<(typeof ASSET_ROLES)[number], string>> = {
      aroll: 'aroll',
      broll: 'broll',
      image: 'images',
      audio: 'audio',
      voice: 'voice',
      logo: 'logo',
      reference: 'reference',
    };

    for (const role of ASSET_ROLES) {
      const directory = RAW_DIRECTORY_BY_ROLE[role];
      expect(sectionById(GUIDE_EN, 'library')?.body).toContain(`raw/${directory}/`);
      expect(sectionById(GUIDE_ES, 'library')?.body).toContain(`raw/${directory}/`);
    }
  });

  it('tabulates every output preset with its id and its readable name', () => {
    const english = sectionById(GUIDE_EN, 'presets')?.body ?? '';
    const spanish = sectionById(GUIDE_ES, 'presets')?.body ?? '';

    for (const preset of OUTPUT_PRESETS) {
      expect(english).toContain(`\`${preset}\``);
      expect(spanish).toContain(`\`${preset}\``);
      expect(english).toContain(MESSAGES_EN[`outputPreset.${preset}.label`]);
      expect(spanish).toContain(MESSAGES_ES[`outputPreset.${preset}.label`]);
    }
  });

  it('tabulates every montage preset with its id and its readable name', () => {
    const english = sectionById(GUIDE_EN, 'library')?.body ?? '';
    const spanish = sectionById(GUIDE_ES, 'library')?.body ?? '';

    for (const preset of MONTAGE_PRESETS) {
      expect(english).toContain(`\`${preset}\``);
      expect(spanish).toContain(`\`${preset}\``);
      expect(english).toContain(MESSAGES_EN[`montagePreset.${preset}.label`]);
      expect(spanish).toContain(MESSAGES_ES[`montagePreset.${preset}.label`]);
    }
  });

  it('describes the three flows the dev asked for, in both languages', () => {
    expect(parseProducerMarkdown(sectionById(GUIDE_EN, 'flows')?.body ?? '')).toHaveLength(3);
    expect(parseProducerMarkdown(sectionById(GUIDE_ES, 'flows')?.body ?? '')).toHaveLength(3);
  });

  it('renders with the markdown the producer already speaks, tables included', () => {
    const blocks = parseProducerMarkdown(sectionById(GUIDE_EN, 'library')?.body ?? '');

    expect(blocks.filter((block) => block.kind === 'table')).toHaveLength(2);
  });
});

describe('loadGuideContent', () => {
  it('loads each language lazily, out of the initial chunk', async () => {
    expect(await loadGuideContent('en')).toBe(GUIDE_EN);
    expect(await loadGuideContent('es')).toBe(GUIDE_ES);
  });
});
