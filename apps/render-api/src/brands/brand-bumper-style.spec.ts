import { describe, expect, it } from 'vitest';
import type { BrandManifest } from '@video-maker/motion-graphics';

import { brandBumperStyle } from './project-brand-context';

const palette = { background: '#09090b', accent: '#0ea5e9', accent2: '#14b8a6', text: '#fafafa' };

function manifest(extra: Partial<BrandManifest>): BrandManifest {
  return { url: 'displayads.com.ar', ...extra } as BrandManifest;
}

describe('brandBumperStyle', () => {
  it('toma los colores de la paleta y la web como remate del outro', () => {
    expect(brandBumperStyle(manifest({}), palette)).toEqual({
      accentColor: '#0ea5e9',
      secondaryColor: '#14b8a6',
      outroCaption: 'displayads.com.ar',
    });
  });

  it('suma los pools del bloque bumpers y su remate gana sobre la web', () => {
    const style = brandBumperStyle(
      manifest({ bumpers: { backgrounds: ['noise', 'glow'], reveals: ['pop'], outroCaption: 'Tus pantallas, bajo control.' } }),
      palette,
    );

    expect(style).toMatchObject({ backgrounds: ['noise', 'glow'], reveals: ['pop'], outroCaption: 'Tus pantallas, bajo control.' });
  });

  it('descarta colores que no son hex de 6 dígitos y webs demasiado largas', () => {
    const style = brandBumperStyle(manifest({ url: `https://${'x'.repeat(70)}.com` }), { ...palette, accent: 'rgb(1, 2, 3)', accent2: '#abc' });

    expect(style).toEqual({});
  });
});
