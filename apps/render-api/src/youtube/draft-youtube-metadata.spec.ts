import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { resolveMediaProject } from '@video-maker/auto-montage';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeAiAgent } from '../__fixtures__/fake-ai-agent';
import { createFakeObjectStorage } from '../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import type { ProjectBrandContext } from '../brands/project-brand-context';
import { toErrorPayload } from '../errors/to-error-payload';
import {
  DRAFT_MAX_TAGS,
  draftYoutubeMetadata,
  finalizeDraft,
  isShortVideo,
  normalizeTags,
  youtubeDraftJsonSchema,
} from './draft-youtube-metadata';
import type { YoutubeDraftInput } from './draft-youtube-metadata';

const REAL_ASSETS = fileURLToPath(new URL('../../../../libs/motion-graphics/assets/', import.meta.url));
const MOTION_STORYBOARD = readFileSync(`${REAL_ASSETS}storyboards/displayads/easy-pro.json`, 'utf8');

const BRAND = {
  id: 'displayads',
  name: 'Display Ads',
  tagline: 'Tu local, en pantalla',
  url: 'https://displayads.example',
} as unknown as ProjectBrandContext;

function input(overrides: Partial<YoutubeDraftInput> = {}): YoutubeDraftInput {
  return {
    project: resolveMediaProject('/media/promo'),
    mode: 'motion',
    brand: BRAND,
    durationSec: 42,
    width: 1920,
    height: 1080,
    credits: null,
    ...overrides,
  };
}

function harness(answer: unknown, files: { path: string; contents: string }[] = []) {
  const callLog = createCallLog();
  const agent = createFakeAiAgent(answer);
  const storage = createFakeObjectStorage(callLog, { directories: ['/media/promo'], files });
  const deps = createFakeRenderApiDependencies(callLog, { aiAgent: agent.agent, storage });
  return { deps, agent };
}

const GOOD_ANSWER = {
  title: 'Cómo instalar el Isi Pro',
  description: 'Instalalo en minutos.\n\nPaso a paso.',
  tags: ['display ads', '#instalacion', 'Display Ads'],
};

describe('isShortVideo', () => {
  it('is true only for vertical videos of at most 180 seconds', () => {
    expect(isShortVideo(1080, 1920, 180)).toBe(true);
    expect(isShortVideo(1080, 1920, 181)).toBe(false);
    expect(isShortVideo(1920, 1080, 30)).toBe(false);
    expect(isShortVideo(1080, 1080, 30)).toBe(false);
  });
});

describe('youtubeDraftJsonSchema', () => {
  it('requires title, description and tags and carries no schema identity key', () => {
    const schema = youtubeDraftJsonSchema();

    expect(schema).not.toHaveProperty('$schema');
    expect(schema).not.toHaveProperty('$id');
    expect(schema.required).toEqual(['title', 'description', 'tags']);
    expect(Object.keys(schema.properties as object).sort()).toEqual(['description', 'tags', 'title']);
  });
});

describe('draftYoutubeMetadata', () => {
  it('asks the agent with the schema, the brand, the duration and the motion storyboard voice-over lines', async () => {
    const h = harness(GOOD_ANSWER, [{ path: '/media/promo/motion/storyboard.json', contents: MOTION_STORYBOARD }]);

    await draftYoutubeMetadata(h.deps, input());

    expect(h.agent.requests).toHaveLength(1);
    const request = h.agent.requests[0];
    expect(request?.jsonSchema).toEqual(youtubeDraftJsonSchema());
    expect(request?.systemPrompt).toContain('rioplatense');
    expect(request?.userPrompt).toContain('Display Ads');
    expect(request?.userPrompt).toContain('Tu local, en pantalla');
    expect(request?.userPrompt).toContain('https://displayads.example');
    expect(request?.userPrompt).toContain('42 seconds');
    expect(request?.userPrompt).toContain('Conectá el Isi Pro a una entrada HDMI del televisor.');
  });

  it('reads the voice script lines of a footage project and says so when there is no script at all', async () => {
    const manifest = {
      schemaVersion: 1,
      source: 'script',
      language: 'es-AR',
      voiceId: 'es_AR-daniela-high',
      gapMs: 900,
      path: 'work/voice/voice.wav',
      wordsPath: 'work/voice/voice.words.json',
      durationMs: 2000,
      sampleRate: 48000,
      updatedAt: '2026-10-08T10:00:00.000Z',
      lines: [{ index: 1, text: 'Primera linea del guion.', path: 'work/voice/line-01.wav', startMs: 0, durationMs: 2000 }],
    };
    const withScript = harness(GOOD_ANSWER, [
      { path: '/media/promo/work/voice/script-manifest.json', contents: JSON.stringify(manifest) },
    ]);
    await draftYoutubeMetadata(withScript.deps, input({ mode: 'footage' }));
    expect(withScript.agent.requests[0]?.userPrompt).toContain('Primera linea del guion.');

    const withoutScript = harness(GOOD_ANSWER);
    await draftYoutubeMetadata(withoutScript.deps, input({ mode: 'footage' }));
    expect(withoutScript.agent.requests[0]?.userPrompt).toContain('no script available');
  });

  it('returns exactly title, description and tags', async () => {
    const h = harness(GOOD_ANSWER);

    const draft = await draftYoutubeMetadata(h.deps, input());

    expect(Object.keys(draft).sort()).toEqual(['description', 'tags', 'title']);
  });

  it('retries once when the first answer does not match the schema and fails with AI_AGENT_INVALID_OUTPUT when the second does not either', async () => {
    const repaired = harness((_request: unknown, index: number) => (index === 0 ? { title: '' } : GOOD_ANSWER));
    const draft = await draftYoutubeMetadata(repaired.deps, input());
    expect(draft.title).toBe('Cómo instalar el Isi Pro');
    expect(repaired.agent.requests).toHaveLength(2);

    const broken = harness({ nope: true });
    const error = await draftYoutubeMetadata(broken.deps, input()).catch((cause: unknown) => toErrorPayload(cause));
    expect(error).toMatchObject({ code: 'AI_AGENT_INVALID_OUTPUT' });
    expect(broken.agent.requests).toHaveLength(2);
  });

  it('lets the agent errors through untouched', async () => {
    const h = harness(new Error('boom'));

    await expect(draftYoutubeMetadata(h.deps, input())).rejects.toThrow('boom');
  });
});

describe('finalizeDraft', () => {
  const base = { title: 'Titulo', description: 'Un parrafo.', tags: ['a'] };

  it('caps the title at 100 characters', () => {
    const draft = finalizeDraft({ ...base, title: 'x'.repeat(150) }, input());

    expect(draft.title).toHaveLength(100);
  });

  it('adds #Shorts to the title of a short, within 100 characters, and never twice', () => {
    const short = input({ width: 1080, height: 1920, durationSec: 30 });

    const draft = finalizeDraft({ ...base, title: 'y'.repeat(120) }, short);
    expect(draft.title.endsWith(' #Shorts')).toBe(true);
    expect(draft.title.length).toBeLessThanOrEqual(100);

    expect(finalizeDraft({ ...base, title: 'Hola #shorts' }, short).title).toBe('Hola #shorts');
  });

  it('does not add #Shorts to a landscape video', () => {
    expect(finalizeDraft(base, input()).title).toBe('Titulo');
  });

  it('adds the brand url when the description lacks it and the credits once', () => {
    const credits = 'Música: Tema por Autor';

    const draft = finalizeDraft({ ...base, description: 'Un parrafo.' }, input({ credits }));
    expect(draft.description).toBe(`Un parrafo.\n\nhttps://displayads.example\n\n${credits}`);

    const already = finalizeDraft(
      { ...base, description: `Un parrafo.\n\nhttps://displayads.example\n\n${credits}` },
      input({ credits }),
    );
    expect(already.description).toBe(`Un parrafo.\n\nhttps://displayads.example\n\n${credits}`);
  });

  it('leaves the description alone when there is no brand and no credits', () => {
    expect(finalizeDraft(base, input({ brand: null })).description).toBe('Un parrafo.');
  });
});

describe('normalizeTags', () => {
  it('strips the hash, drops duplicates ignoring case and empty tags, and keeps at most 15', () => {
    const tags = normalizeTags(['#uno', 'Uno', ' ', 'dos', ...Array.from({ length: 30 }, (_, index) => `t${String(index)}`)]);

    expect(tags.slice(0, 2)).toEqual(['uno', 'dos']);
    expect(tags).toHaveLength(DRAFT_MAX_TAGS);
  });

  it('keeps the total length within 500 characters', () => {
    const tags = normalizeTags(Array.from({ length: 15 }, (_, index) => `${String(index)}${'z'.repeat(60)}`));

    expect(tags.reduce((total, tag) => total + tag.length, 0)).toBeLessThanOrEqual(500);
    expect(tags.length).toBeLessThan(15);
  });
});

describe('spoken brand names', () => {
  const SPOKEN_BRAND = {
    ...BRAND,
    writtenNames: [
      { spoken: 'Isi Pro', written: 'Easy Pro' },
      { spoken: 'Display Ads', written: 'DisplayAds' },
    ],
  } as unknown as ProjectBrandContext;

  it('gives the model the script with the written product names, not the ones spelled for the voice', async () => {
    const h = harness(GOOD_ANSWER, [{ path: '/media/promo/motion/storyboard.json', contents: MOTION_STORYBOARD }]);

    await draftYoutubeMetadata(h.deps, input({ brand: SPOKEN_BRAND }));

    expect(h.agent.requests[0]?.userPrompt).toContain('Easy Pro');
    expect(h.agent.requests[0]?.userPrompt).not.toContain('Isi Pro');
  });

  it('restores the written names in the title, description and tags the model answers', () => {
    const draft = finalizeDraft(
      { title: 'Cómo instalar el Isi Pro', description: 'Con Display Ads y el isi pro.', tags: ['isi pro', 'display ads'] },
      input({ brand: SPOKEN_BRAND }),
    );

    expect(draft.title).toBe('Cómo instalar el Easy Pro');
    expect(draft.description.startsWith('Con DisplayAds y el Easy Pro.')).toBe(true);
    expect(draft.tags).toEqual(['Easy Pro', 'DisplayAds']);
  });

  it('keeps the brand written with a space when its written name is "Display Ads" (FIX-e-burgos-013)', () => {
    const brand = { ...BRAND, writtenNames: [{ spoken: 'Isi Pro', written: 'Easy Pro' }] } as unknown as ProjectBrandContext;

    const draft = finalizeDraft(
      { title: 'Cómo instalar el Isi Pro en Display Ads', description: 'Display Ads y el isi pro.', tags: ['display ads'] },
      input({ brand }),
    );

    expect(draft.title).toBe('Cómo instalar el Easy Pro en Display Ads');
    expect(draft.description.startsWith('Display Ads y el Easy Pro.')).toBe(true);
  });
});
