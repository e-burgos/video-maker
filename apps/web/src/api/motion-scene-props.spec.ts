import { describe, expect, it } from 'vitest';

import { motionImagePath, motionPropEntries } from './motion-scene-props';

describe('motionPropEntries', () => {
  it('keeps string fields and string arrays, classifying images and brand references', () => {
    const entries = motionPropEntries({
      title: 'Nuevo lanzamiento',
      bullets: ['Rápido', 'Simple'],
      photo: 'images/casa.jpg',
      logo: 'brand:logo-main',
      gallery: ['images/a.jpg', 'images/b.jpg'],
    });

    expect(entries).toEqual([
      { name: 'title', values: [{ kind: 'text', text: 'Nuevo lanzamiento' }] },
      {
        name: 'bullets',
        values: [
          { kind: 'text', text: 'Rápido' },
          { kind: 'text', text: 'Simple' },
        ],
      },
      { name: 'photo', values: [{ kind: 'image', file: 'casa.jpg' }] },
      { name: 'logo', values: [{ kind: 'brand', ref: 'logo-main' }] },
      {
        name: 'gallery',
        values: [
          { kind: 'image', file: 'a.jpg' },
          { kind: 'image', file: 'b.jpg' },
        ],
      },
    ]);
  });

  it('drops numbers, nested objects, empty strings and arrays without strings', () => {
    expect(
      motionPropEntries({ count: 3, nested: { a: 'x' }, blank: '  ', mixed: [1, { a: 1 }], flag: true }),
    ).toEqual([]);
  });
});

describe('motionImagePath', () => {
  it('maps an image file to its place in the project', () => {
    expect(motionImagePath('casa.jpg')).toBe('work/motion/images/casa.jpg');
  });
});
