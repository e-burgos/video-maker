import { describe, expect, it } from 'vitest';

import { TimelineBumpersSchema } from '../schemas/timeline.schema';
import { resolveBumperLook } from './resolve-bumper-look';

const both = (extra: object = {}) =>
  TimelineBumpersSchema.parse({ intro: { enabled: true }, outro: { enabled: true, backgroundColor: '#0b1020' }, ...extra });

describe('resolveBumperLook', () => {
  it('sin rotate queda como siempre: fondo liso y el revelado de animation', () => {
    const look = resolveBumperLook(both(), 'intro', 'video-a');

    expect(look).toMatchObject({ background: 'solid', reveal: 'zoom', baseColor: '#ffffff', caption: null });
  });

  it('con rotate el intro y el outro nunca comparten fondo ni revelado', () => {
    for (const key of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      const bumpers = both({ style: { rotate: true } });
      const intro = resolveBumperLook(bumpers, 'intro', key);
      const outro = resolveBumperLook(bumpers, 'outro', key);
      expect(outro?.background).not.toBe(intro?.background);
      expect(outro?.reveal).not.toBe(intro?.reveal);
    }
  });

  it('con rotate cada video sale distinto y el mismo video siempre igual', () => {
    const bumpers = both({ style: { rotate: true } });
    const looks = ['v1', 'v2', 'v3', 'v4', 'v5', 'v6'].map((key) => {
      const look = resolveBumperLook(bumpers, 'intro', key);
      return `${look?.background}/${look?.reveal}`;
    });

    expect(resolveBumperLook(bumpers, 'intro', 'v1')).toEqual(resolveBumperLook(bumpers, 'intro', 'v1'));
    expect(new Set(looks).size).toBeGreaterThan(3);
  });

  it('respeta los pools de la marca, lo explícito y el remate del outro', () => {
    const bumpers = both({
      style: { rotate: true, backgrounds: ['noise', 'glow'], reveals: ['wipe', 'pop'], accentColor: '#ff0000', outroCaption: 'acme.test' },
    });
    const explicit = TimelineBumpersSchema.parse({ ...bumpers, intro: { enabled: true, background: 'shapes', reveal: 'fade', caption: 'Hola' } });

    expect(['noise', 'glow']).toContain(resolveBumperLook(bumpers, 'intro', 'x')?.background);
    expect(['wipe', 'pop']).toContain(resolveBumperLook(bumpers, 'outro', 'x')?.reveal);
    expect(resolveBumperLook(bumpers, 'outro', 'x')).toMatchObject({ accentColor: '#ff0000', caption: 'acme.test' });
    expect(resolveBumperLook(explicit, 'intro', 'x')).toMatchObject({ background: 'shapes', reveal: 'fade', caption: 'Hola' });
    expect(resolveBumperLook(explicit, 'outro', 'x')?.background).not.toBe('shapes');
  });

  it('la semilla del estilo manda sobre la clave del video', () => {
    const withSeed = (seed: number) => both({ style: { rotate: true, seed } });

    expect(resolveBumperLook(withSeed(7), 'intro', 'a')).toEqual(resolveBumperLook(withSeed(7), 'intro', 'b'));
  });

  it('devuelve null si ese bumper no existe', () => {
    expect(resolveBumperLook(TimelineBumpersSchema.parse({}), 'intro', 'x')).toBeNull();
  });
});
