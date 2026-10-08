import type { BrandDetail, BrandManifest, BrandSummary } from '../brand-types';

export function brandManifest(overrides: Partial<BrandManifest> = {}): BrandManifest {
  return {
    id: 'mine',
    name: 'Mine',
    spokenName: 'Mine',
    tagline: 'Tu mensaje, en video.',
    logo: 'img/logo.svg',
    palette: { background: '#09090b', accent: '#0ea5e9', accent2: '#14b8a6', text: '#fafafa' },
    typography: { display: 'Outfit', body: 'Outfit' },
    fonts: [{ family: 'Outfit', file: 'fonts/outfit.woff2' }],
    devices: {},
    images: {},
    music: [],
    voice: { id: 'es_AR-daniela-high', lengthScale: 1 },
    ...overrides,
  };
}

export function brandDetail(overrides: Partial<BrandDetail> = {}): BrandDetail {
  const manifest = overrides.manifest ?? brandManifest();
  return {
    id: manifest.id,
    source: 'user',
    manifest,
    tokens: {
      '--mg-bg': '#09090b',
      '--mg-accent': '#0ea5e9',
      '--mg-accent-2': '#38bdf8',
      '--mg-text': '#fafafa',
      '--mg-radius': '28px',
    },
    files: {
      images: [],
      fonts: ['fonts/outfit.woff2'],
      music: [],
      logos: ['img/logo.svg'],
    },
    ...overrides,
  };
}

export function brandSummary(overrides: Partial<BrandSummary> = {}): BrandSummary {
  return {
    id: 'mine',
    name: 'Mine',
    source: 'user',
    logo: 'img/logo.svg',
    palette: { background: '#09090b', accent: '#0ea5e9', accent2: '#14b8a6', text: '#fafafa' },
    updatedAt: '2026-10-08T10:00:00.000Z',
    ...overrides,
  };
}
