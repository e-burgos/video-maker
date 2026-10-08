import { describe, expect, it } from 'vitest';

import { catalogStoryboard, testBrand } from '../__fixtures__/catalog-storyboard';
import { MotionStudioError } from '../errors/motion-studio-error';
import type { MotionStoryboard } from '../storyboard/motion-storyboard.schema';
import { brandImageUrl, composeStoryboard, storyboardImages } from './compose-storyboard';

const pick = (...ids: string[]): MotionStoryboard => ({ ...catalogStoryboard, scenes: catalogStoryboard.scenes.filter((s) => ids.includes(s.id)) });
const base = pick('hook', 'reveal', 'gallery', 'cta');

describe('composeStoryboard', () => {
  it('declares the font format from the file extension', () => {
    const { template } = composeStoryboard(base, { ...testBrand, fonts: [{ family: 'Brand', file: 'fonts/brand.ttf' }, { family: 'Brand2', file: 'fonts/brand.otf' }] });
    expect(template).toContain('fonts/brand.ttf") format("truetype")');
    expect(template).toContain('fonts/brand.otf") format("opentype")');
  });

  it('writes one timed section per scene with chapter, flash and the brand kit', () => {
    const { template } = composeStoryboard(base, testBrand);
    expect(template.match(/<section id="s-/gu)).toHaveLength(4);
    expect(template).toContain('data-start="{{start:reveal}}" data-duration="{{dur:reveal}}"');
    expect(template).toContain('data-chapter="Plataforma" data-flash="1"');
    expect(template).toContain('<title>Catálogo &lt;completo&gt;</title>');
    expect(template).toContain('url("assets/brand/fonts/mono.woff2") format("woff2"); font-weight: 400;');
    expect(template).toContain('class="fmt-16x9"');
    expect(template).toContain('data-scene="cta" data-chapter-end="1"');
    expect(template).toContain('data-width="1920" data-height="1080"');
    expect(template).toContain('{{music_track}}');
    expect(template).toContain('id="sfx-impact"');
    expect(template).not.toContain('{{music_credit}}');
  });

  it('builds the script with the brand voice, default bars and the drop anchor from the track', () => {
    const { script, musicSource } = composeStoryboard(base, testBrand);
    expect(script.voice).toBe('es_AR-daniela-high');
    expect(script.music).toEqual({ file: 'Beat Song.mp3', credit: 'Beat · CC BY 4.0' });
    expect(script.scenes.map((s) => s.minBars)).toEqual([3, 3, 4, 5]);
    expect(script.scenes[1]).toMatchObject({ id: 'reveal', anchor: 12.5 });
    expect(script.noWhooshOn).toEqual(['reveal']);
    expect(script.sfx).toEqual([{ id: 'riser', scene: 'reveal', offset: -3.4 }]);
    expect(musicSource).toBe('assets/brand/music/Beat Song.mp3');
  });

  it('carries the music volume of the storyboard into the script', () => {
    const { script } = composeStoryboard({ ...base, music: { track: 'beat', volume: 0.3 } }, testBrand);
    expect(script.music).toEqual({ file: 'Beat Song.mp3', credit: 'Beat · CC BY 4.0', volume: 0.3 });
  });

  it('drops anchors without beat sync and music without a track', () => {
    const silent = composeStoryboard({ ...base, music: null, beatSync: false, voice: { id: 'otra', lengthScale: 1 } }, testBrand);
    expect(silent.script.music).toBeNull();
    expect(silent.musicSource).toBeNull();
    expect(silent.script.voice).toBe('otra');
    expect(silent.script.scenes[1]).not.toHaveProperty('anchor');
    expect(silent.template).not.toContain('sfx-impact');
    expect(silent.template).not.toContain('mg-credit');
    const numeric = composeStoryboard({ ...pick('hook', 'cta'), scenes: pick('hook', 'cta').scenes.map((s) => ({ ...s, anchor: 30 })) }, testBrand);
    expect(numeric.script.scenes[0]).toMatchObject({ anchor: 30 });
    expect(numeric.script.noWhooshOn).toEqual([]);
  });

  it('composes vertical videos at 1080x1920', () => {
    const { template } = composeStoryboard({ ...base, format: '9:16' }, testBrand);
    expect(template).toContain('class="fmt-9x16"');
    expect(template).toContain('data-width="1080" data-height="1920"');
  });

  it('fails on a brand mismatch or an unknown track', () => {
    expect(() => composeStoryboard({ ...base, brand: 'otra' }, testBrand)).toThrow(MotionStudioError);
    expect(() => composeStoryboard({ ...base, music: { track: 'nope' } }, testBrand)).toThrow(/no music track "nope"/u);
  });

  it('lists the project images the storyboard needs, leaving brand assets out', () => {
    expect(storyboardImages(catalogStoryboard)).toEqual(['images/foto.jpg', 'images/otra.jpg']);
  });

  it('resolves brand image refs through the manifest', () => {
    expect(brandImageUrl('brand:local', testBrand)).toBe('assets/brand/img/local.jpg');
    expect(brandImageUrl('brand:img/x.png', testBrand)).toBe('assets/brand/img/x.png');
    expect(brandImageUrl('brand:img/x.png')).toBe('assets/brand/img/x.png');
    expect(brandImageUrl('images/a.jpg', testBrand)).toBe('images/a.jpg');
  });
});

describe('brandImageUrl', () => {
  it('resolves plain and captioned brand images to their file', () => {
    expect(brandImageUrl('brand:local', testBrand)).toMatch(/\/img\/local\.jpg$/u);
    expect(brandImageUrl('brand:cafe', testBrand)).toMatch(/\/img\/scenes\/cafe\.jpg$/u);
    expect(brandImageUrl('images/foto.jpg', testBrand)).toBe('images/foto.jpg');
  });

describe('brand photos', () => {
  it('fails up front, naming the photo, when the storyboard asks for a brand photo that is not in the kit', () => {
    const withGone = { ...catalogStoryboard, scenes: [{ id: 'g', kind: 'gallery' as const, vo: 'Fotos', props: { images: ['brand:local', 'brand:escena-04'] } }] };
    expect(() => composeStoryboard(withGone as MotionStoryboard, testBrand)).toThrow(/brand photo "escena-04" is not in the brand kit/u);
  });
});
});
