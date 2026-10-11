import { describe, expect, it } from 'vitest';

import { minimalBrand, testBrand } from '../__fixtures__/catalog-storyboard';
import { SCENE_KINDS } from '../storyboard/motion-storyboard.schema';
import { buildAutoStoryboardRequest } from './build-auto-storyboard-request';
import type { MotionBrief } from './motion-brief';
import { SCENE_GUIDE } from './scene-guide';

const brief: MotionBrief = {
  version: 1,
  brand: 'acme',
  format: '9:16',
  beatSync: true,
  music: 'auto',
  title: 'Promo de invierno',
  goal: 'Vender el plan',
  audience: 'Dueños de locales',
  script: 'Tu pantalla trabaja sola.',
  images: [{ file: 'local.jpg', caption: 'Un local con la pantalla encendida' }],
};

describe('SCENE_GUIDE', () => {
  it('has one non-empty line for every scene kind of the catalog', () => {
    expect(Object.keys(SCENE_GUIDE).sort()).toEqual([...SCENE_KINDS].sort());
    for (const kind of SCENE_KINDS) expect(SCENE_GUIDE[kind].trim()).not.toBe('');
  });
});

describe('buildAutoStoryboardRequest', () => {
  const request = buildAutoStoryboardRequest(brief, testBrand);

  it('lists every scene kind in the system prompt together with its guide', () => {
    for (const kind of SCENE_KINDS) expect(request.systemPrompt).toContain(`- ${kind}: ${SCENE_GUIDE[kind]}`);
  });

  it('offers the ui walkthrough only when the brief brings a capture to explain', () => {
    expect(request.systemPrompt).toContain('- ui-walkthrough:');
    expect(buildAutoStoryboardRequest({ ...brief, images: [] }, testBrand).systemPrompt).not.toContain('- ui-walkthrough:');
  });

  it('states the hard rules of the contract', () => {
    expect(request.systemPrompt).toMatch(/ONLY a JSON object/u);
    expect(request.systemPrompt).toMatch(/number.*as words/u);
    expect(request.systemPrompt).toMatch(/never the first words of a line/u);
    expect(request.systemPrompt).toMatch(/hook.*cta/u);
    expect(request.systemPrompt).toMatch(/anchor: "drop"/u);
    expect(request.systemPrompt).toMatch(/beginning of a word/u);
    expect(request.systemPrompt).toMatch(/images\/<file>.*brand:<key>/u);
  });

  it('describes brand photos by their caption and never offers a retired device', () => {
    expect(request.userPrompt).toContain('brand:cafe (Cafetería con el menú en pantallas)');
    expect(request.userPrompt).not.toMatch(/\bold \(Old/u);
    expect(request.userPrompt).toContain('dark (Dark, box; in vo write it "Dark Ei")');
  });

  it('gives the brand url and forbids inventing urls or voices', () => {
    expect(request.userPrompt).toContain(`url: ${testBrand.url}`);
    expect(request.systemPrompt).toMatch(/Never invent a URL/u);
    expect(request.systemPrompt).toMatch(/Leave `voice` out/u);
  });

  it('gives the brand data: spoken name, tagline, devices, brand images and tracks with mood, bpm and drop', () => {
    expect(request.userPrompt).toContain('spoken name: Acme');
    expect(request.userPrompt).toContain('Todo bajo control. Con IA.');
    expect(request.userPrompt).toContain('counter (Counter, counter)');
    expect(request.userPrompt).toContain('brand:local');
    expect(request.userPrompt).toContain('beat (energetic, 120 BPM, drop at 12.5s)');
    expect(request.userPrompt).toContain('calm (calm, 100 BPM, no drop)');
  });

  it('gives the brief: goal, audience, format, images with captions and the script', () => {
    expect(request.userPrompt).toContain('goal: Vender el plan');
    expect(request.userPrompt).toContain('audience: Dueños de locales');
    expect(request.userPrompt).toContain('format: 9:16');
    expect(request.userPrompt).toContain('- images/local.jpg: Un local con la pantalla encendida');
    expect(request.userPrompt.endsWith('SCRIPT\nTu pantalla trabaja sola.')).toBe(true);
  });

  it('adapts the music instruction to auto, a fixed track and silence', () => {
    expect(request.userPrompt).toContain('choose the track');
    expect(buildAutoStoryboardRequest({ ...brief, music: 'calm' }, testBrand).userPrompt).toContain('use the track "calm"');
    expect(buildAutoStoryboardRequest({ ...brief, music: null, images: [] }, testBrand).userPrompt).toMatch(/music: no music[\s\S]*images: none/u);
  });

  it('attaches the storyboard json schema without identity keys', () => {
    expect(request.jsonSchema).not.toHaveProperty('$schema');
    expect(JSON.stringify(request.jsonSchema)).toContain('"brand-reveal"');
  });
});

describe('buildAutoStoryboardRequest with a minimal brand', () => {
  const noImagesBrief: MotionBrief = { ...brief, images: [] };
  const request = buildAutoStoryboardRequest(noImagesBrief, minimalBrand);

  it('declares the missing assets and limits what the model may use', () => {
    expect(request.userPrompt).toContain('devices: none');
    expect(request.userPrompt).toContain('brand images: none');
    expect(request.userPrompt).toContain('music tracks: none');
    expect(request.userPrompt).toContain('ASSET LIMITS');
    expect(request.userPrompt).toMatch(/no devices[^\n]*connections/u);
    expect(request.userPrompt).toMatch(/no images at all/u);
    expect(request.userPrompt).toMatch(/no music tracks: use `music: null`/u);
  });

  it('asks for silence even when the brief says auto', () => {
    expect(request.userPrompt).toContain('music: no music (use music: null)');
    expect(request.userPrompt).not.toContain('choose the track');
  });

  it('does not offer scenes that need devices or several photos', () => {
    expect(request.systemPrompt).not.toContain('- connections:');
    expect(request.systemPrompt).not.toContain('- gallery:');
    expect(request.systemPrompt).toContain('- hook:');
    expect(request.systemPrompt).toContain('- cta:');
  });

  it('offers the gallery once the brief supplies at least two photos', () => {
    const twoPhotos: MotionBrief = { ...brief, images: [{ file: 'a.jpg', caption: 'A' }, { file: 'b.jpg', caption: 'B' }] };
    const withPhotos = buildAutoStoryboardRequest(twoPhotos, minimalBrand);
    expect(withPhotos.systemPrompt).toContain('- gallery:');
    expect(withPhotos.userPrompt).not.toMatch(/no images at all/u);
  });

  it('adds no limits section for a complete brand', () => {
    expect(buildAutoStoryboardRequest(brief, testBrand).userPrompt).not.toContain('ASSET LIMITS');
  });
});
