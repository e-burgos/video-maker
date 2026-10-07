import type { BrandManifest } from '../../brand/brand-manifest';
import { parseMotionScript } from '../../script/motion-script';
import type { MotionStoryboard } from '../../storyboard/motion-storyboard.schema';
import { wavBytes } from './fake-pipeline-ports';

export const P = '/work/promo';

export const script = {
  voice: 'es_AR-daniela-high',
  lengthScale: 1.08,
  music: { file: 'tema.mp3', credit: 'Tema · CC BY 4.0' },
  scenes: [
    { id: 'hook', vo: 'Cuánto cuesta una pantalla apagada', minBars: 2 },
    { id: 'reveal', vo: 'Esto es Display Ads', minBars: 2, anchor: 10 },
  ],
  sfx: [{ id: 'riser', scene: 'reveal', offset: -2 }],
};

export const parsedScript = parseMotionScript(script);

export function projectFiles(extra: Record<string, string | Uint8Array> = {}): Record<string, string | Uint8Array> {
  return {
    [`${P}/script.json`]: JSON.stringify(script),
    [`${P}/assets/music/tema.mp3`]: 'mp3',
    [`${P}/assets/audio/vo-hook.wav`]: wavBytes(3),
    [`${P}/assets/audio/vo-reveal.wav`]: wavBytes(1.5),
    ...extra,
  };
}

export const brand: BrandManifest = {
  id: 'acme',
  name: 'Acme',
  spokenName: 'Acme',
  tagline: 'Todo bajo control.',
  logo: 'img/logo.svg',
  isotipo: 'img/iso.svg',
  css: 'brand.css',
  fonts: [{ family: 'Inter', file: 'fonts/inter.woff2' }],
  devices: {},
  images: {},
  music: [{ id: 'tema', file: 'music/tema.mp3', credit: 'Tema · CC BY 4.0', bpm: 120, mood: 'energetic', drop: 10 }],
  voice: { id: 'es_AR-daniela-high', lengthScale: 1.08 },
};

export const storyboard: MotionStoryboard = {
  version: 1,
  title: 'Promo',
  brand: 'acme',
  format: '16:9',
  beatSync: true,
  music: { track: 'tema' },
  scenes: [
    { id: 'hook', kind: 'feature', vo: 'Mirá tu local', props: { title: 'Tu local', bullets: [], visual: { kind: 'image', src: 'images/local.jpg' } } },
    { id: 'cierre', kind: 'cta', vo: 'Probalo hoy', anchor: 'drop', props: { button: 'Probalo' } },
  ],
};

export const brandFiles = (): Record<string, string> => ({
  '/repo/assets/runtime/gsap.min.js': 'gsap',
  '/repo/assets/brands/acme/brand.json': JSON.stringify(brand),
  '/repo/assets/brands/acme/music/tema.mp3': 'mp3',
});
