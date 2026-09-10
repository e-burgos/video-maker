import { TimelineSchema } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { editableTimelineFixture } from '../__fixtures__/editable-timeline';
import {
  DEFAULT_LOGO_POSITION,
  LOGO_POSITIONS,
  clearTimelineLogo,
  logoAssetsOf,
  logoBlockers,
  setTimelineLogo,
} from './logo-overlay';
import type { AssetListing } from '../render-api-types';
import type { MediaAsset } from '@video-maker/timeline-core';

const LOGO_ASSET: MediaAsset = {
  id: 'raw/logo/brand.png',
  kind: 'image',
  path: 'raw/logo/brand.png',
  durationMs: 0,
  width: 800,
  height: 200,
  probedAt: '2026-09-01T00:00:00.000Z',
};

function listing(
  entries: Array<{ role: string; media: unknown }>,
  source: AssetListing['source'] = 'catalog',
): AssetListing {
  return {
    slug: 'demo-01',
    source,
    assets: entries.map((entry, index) => ({
      path: `raw/${entry.role}/file-${index}.png`,
      role: entry.role as AssetListing['assets'][number]['role'],
      fingerprint: { sizeBytes: 1, modifiedAtMs: 1 },
      media: entry.media as AssetListing['assets'][number]['media'],
    })),
    probeFailures: [],
  };
}

describe('logoAssetsOf', () => {
  it('keeps only the probed images stored under the logo role', () => {
    const assets = logoAssetsOf(
      listing([
        { role: 'logo', media: LOGO_ASSET },
        { role: 'image', media: { ...LOGO_ASSET, id: 'raw/images/photo.png' } },
        { role: 'logo', media: null },
      ]),
    );

    expect(assets.map((asset) => asset.id)).toEqual(['raw/logo/brand.png']);
  });

  it('refuses a logo entry whose media does not validate as a MediaAsset', () => {
    expect(logoAssetsOf(listing([{ role: 'logo', media: { id: 'x' } }]))).toEqual([]);
  });

  it('refuses a logo entry the catalog probed as something other than an image', () => {
    expect(
      logoAssetsOf(
        listing([
          {
            role: 'logo',
            media: { ...LOGO_ASSET, kind: 'video', durationMs: 1000, fps: 30 },
          },
        ]),
      ),
    ).toEqual([]);
  });
});

describe('logoBlockers', () => {
  it('says nothing blocks when the catalog has a probed logo', () => {
    expect(logoBlockers(listing([{ role: 'logo', media: LOGO_ASSET }]))).toEqual([]);
  });

  it('asks for the upload when the catalog has no logo', () => {
    expect(logoBlockers(listing([{ role: 'aroll', media: null }]))[0]).toContain('raw/logo/');
  });

  it('explains that a project without a catalog never probed its logo', () => {
    expect(logoBlockers(listing([{ role: 'logo', media: null }], 'raw-scan'))[0]).toContain(
      'no catalog yet',
    );
  });

  it('does not decide before the listing arrives', () => {
    expect(logoBlockers(null)).toHaveLength(1);
  });
});

describe('setTimelineLogo', () => {
  it('adds the overlay and the asset it references, so validateTimeline accepts the document', () => {
    const next = setTimelineLogo(editableTimelineFixture(), LOGO_ASSET, 'bottom-right');

    expect(next.logo).toEqual({
      assetId: 'raw/logo/brand.png',
      position: 'bottom-right',
      widthRatio: 0.32,
      marginRatio: 0.035,
      opacity: 1,
    });
    expect(next.assets.map((asset) => asset.id)).toContain('raw/logo/brand.png');
    expect(TimelineSchema.safeParse(next).success).toBe(true);
  });

  it('defaults the overlay to the bottom right corner, as the engine does', () => {
    expect(DEFAULT_LOGO_POSITION).toBe('bottom-right');
    expect(LOGO_POSITIONS).toEqual(['bottom-right', 'bottom-left', 'top-right', 'top-left']);
  });

  it('moves the logo without adding the asset twice and keeps the ratios already stored', () => {
    const shown = setTimelineLogo(editableTimelineFixture(), LOGO_ASSET, 'bottom-right');
    const tuned = { ...shown, logo: { ...shown.logo, widthRatio: 0.5 } } as typeof shown;
    const moved = setTimelineLogo(tuned, LOGO_ASSET, 'top-left');

    expect(moved.logo?.position).toBe('top-left');
    expect(moved.logo?.widthRatio).toBe(0.5);
    expect(moved.assets.filter((asset) => asset.id === 'raw/logo/brand.png')).toHaveLength(1);
  });

  it('resets the ratios when the logo is replaced by a different asset', () => {
    const shown = setTimelineLogo(editableTimelineFixture(), LOGO_ASSET, 'bottom-right');
    const tuned = { ...shown, logo: { ...shown.logo, widthRatio: 0.5 } } as typeof shown;
    const other: MediaAsset = { ...LOGO_ASSET, id: 'raw/logo/other.png', path: 'raw/logo/other.png' };

    expect(setTimelineLogo(tuned, other, 'bottom-right').logo?.widthRatio).toBe(0.32);
  });
});

describe('clearTimelineLogo', () => {
  it('drops the key instead of leaving it undefined, and takes the asset with it', () => {
    const cleared = clearTimelineLogo(
      setTimelineLogo(editableTimelineFixture(), LOGO_ASSET, 'bottom-right'),
    );

    expect('logo' in cleared).toBe(false);
    expect(cleared.assets.map((asset) => asset.id)).not.toContain('raw/logo/brand.png');
    expect(TimelineSchema.safeParse(cleared).success).toBe(true);
  });

  it('keeps an asset a clip still references', () => {
    const timeline = editableTimelineFixture();
    const referenced = timeline.assets[0] as MediaAsset;
    const shown = setTimelineLogo(timeline, referenced, 'bottom-right');

    expect(clearTimelineLogo(shown).assets.map((asset) => asset.id)).toContain(referenced.id);
  });

  it('leaves a timeline without a logo exactly as it was', () => {
    const timeline = editableTimelineFixture();

    expect(clearTimelineLogo(timeline)).toBe(timeline);
  });
});
