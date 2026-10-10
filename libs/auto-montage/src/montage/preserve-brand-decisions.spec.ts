import type { LogoBumper, MediaAsset, Timeline } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { preserveBrandDecisions } from './preserve-brand-decisions';

const LOGO_ASSET: MediaAsset = {
  id: 'raw/logo/brand.png',
  kind: 'image',
  path: 'raw/logo/brand.png',
  durationMs: 0,
  width: 1200,
  height: 240,
  hasAudio: false,
  probedAt: '2026-01-01T00:00:00.000Z',
};

const BUMPER: LogoBumper = {
  enabled: true,
  durationMs: 3000,
  backgroundColor: '#0b1020',
  animation: 'slide-up',
  logoWidthRatio: 0.55,
};

function timeline(patch: Partial<Timeline> = {}): Timeline {
  return {
    schemaVersion: 1,
    id: 'timeline-demo',
    format: { preset: 'youtube-16x9', width: 1920, height: 1080, fps: 30 },
    durationFrames: 300,
    assets: [LOGO_ASSET],
    tracks: { aroll: [], broll: [], voice: [], music: [], captions: [] },
    audioMix: {
      voice: { integratedLufs: -14, truePeakDbtp: -1, lra: 11 },
      music: { baseGainDb: -8, duckedGainDb: -18, referenceLufs: -16 },
      automation: [],
    },
    ...patch,
  };
}

describe('preserveBrandDecisions', () => {
  it('sin timeline previa devuelve la nueva tal cual', () => {
    const next = timeline();

    expect(preserveBrandDecisions(next, null)).toBe(next);
  });

  it('conserva el logo editado por el usuario sobre el que recalculó el montaje', () => {
    const previous = timeline({
      logo: {
        assetId: LOGO_ASSET.id,
        position: 'top-left',
        widthRatio: 0.12,
        marginRatio: 0.08,
        opacity: 0.5,
      },
    });
    const next = timeline({
      logo: {
        assetId: LOGO_ASSET.id,
        position: 'bottom-right',
        widthRatio: 0.18,
        marginRatio: 0.035,
        opacity: 1,
      },
    });

    expect(preserveBrandDecisions(next, previous).logo).toEqual(previous.logo);
  });

  it('conserva los bumpers editados aunque el montaje nuevo no declare ninguno', () => {
    const previous = timeline({ bumpers: { intro: BUMPER } });

    expect(preserveBrandDecisions(timeline(), previous).bumpers).toEqual({ intro: BUMPER });
  });

  it('no revive un logo cuyo asset ya no está en la Timeline nueva', () => {
    const previous = timeline({
      logo: {
        assetId: 'raw/logo/viejo.png',
        position: 'top-left',
        widthRatio: 0.12,
        marginRatio: 0.035,
        opacity: 1,
      },
    });
    const next = timeline({ assets: [] });

    expect(preserveBrandDecisions(next, previous)).not.toHaveProperty('logo');
  });

  it('arrastra el asset del logo propio de los bumpers aunque el montaje nuevo no lo use (FIX-e-burgos-011)', () => {
    const bumperLogo: MediaAsset = { ...LOGO_ASSET, id: 'raw/logo/largo.png', path: 'raw/logo/largo.png' };
    const previous = timeline({
      assets: [LOGO_ASSET, bumperLogo],
      bumpers: { intro: { ...BUMPER, logoAssetId: bumperLogo.id } },
    });

    const preserved = preserveBrandDecisions(timeline(), previous);

    expect(preserved.assets.map((asset) => asset.id)).toEqual([LOGO_ASSET.id, bumperLogo.id]);
    expect(preserved.bumpers?.intro?.logoAssetId).toBe(bumperLogo.id);
  });

  it('sin decisiones de marca previas no agrega campos vacíos', () => {
    const preserved = preserveBrandDecisions(timeline(), timeline());

    expect(preserved).not.toHaveProperty('logo');
    expect(preserved).not.toHaveProperty('bumpers');
  });
});
