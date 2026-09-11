import type { Timeline } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { buildMinimalTimeline } from '../__fixtures__/minimal-timeline';
import {
  describeTimelineAssetReferences,
  findTimelineAssetReferences,
} from './timeline-asset-references';

const AROLL_ASSET_ID = 'raw/aroll/clip01.mp4';
const MUSIC_ASSET_ID = 'raw/audio/music01.mp3';
const LOGO_ASSET_ID = 'raw/logo/brand.png';

function timelineUsing(assetId: string): Timeline {
  const base = buildMinimalTimeline();
  const firstClip = base.tracks.aroll[0];
  if (firstClip === undefined) {
    throw new Error('the minimal timeline fixture has no aroll clip to retarget');
  }

  return {
    ...base,
    assets: base.assets.map((asset) => ({ ...asset, id: assetId, path: assetId })),
    tracks: {
      ...base.tracks,
      aroll: [{ ...firstClip, id: 'clip-aroll-1', assetId }],
      music: [
        {
          id: 'clip-music-1',
          assetId: MUSIC_ASSET_ID,
          from: 0,
          durationFrames: 30,
          trimStartMs: 0,
          gainDb: -12,
        },
      ],
    },
    logo: {
      assetId: LOGO_ASSET_ID,
      position: 'bottom-right',
      widthRatio: 0.32,
      marginRatio: 0.035,
      opacity: 1,
    },
  };
}

describe('findTimelineAssetReferences', () => {
  it('finds no reference when the project has no stored timeline', () => {
    expect(findTimelineAssetReferences(null, AROLL_ASSET_ID)).toEqual([]);
  });

  it('reports the asset entry and every clip that points at it', () => {
    const references = findTimelineAssetReferences(timelineUsing(AROLL_ASSET_ID), AROLL_ASSET_ID);

    expect(references).toEqual([
      { kind: 'asset' },
      { kind: 'clip', track: 'aroll', clipId: 'clip-aroll-1' },
    ]);
  });

  it('reports a clip of a track the asset entries do not list', () => {
    const references = findTimelineAssetReferences(timelineUsing(AROLL_ASSET_ID), MUSIC_ASSET_ID);

    expect(references).toEqual([{ kind: 'clip', track: 'music', clipId: 'clip-music-1' }]);
  });

  it('reports the logo overlay', () => {
    const references = findTimelineAssetReferences(timelineUsing(AROLL_ASSET_ID), LOGO_ASSET_ID);

    expect(references).toEqual([{ kind: 'logo' }]);
  });

  it('finds nothing for an asset the timeline never mentions', () => {
    expect(findTimelineAssetReferences(timelineUsing(AROLL_ASSET_ID), 'raw/broll/unused.mp4')).toEqual(
      [],
    );
  });

  it('reads the logo of a timeline that declares none', () => {
    const withoutLogo: Timeline = { ...timelineUsing(AROLL_ASSET_ID), logo: undefined };

    expect(findTimelineAssetReferences(withoutLogo, LOGO_ASSET_ID)).toEqual([]);
  });
});

describe('describeTimelineAssetReferences', () => {
  it('names every use in one line', () => {
    expect(
      describeTimelineAssetReferences([
        { kind: 'asset' },
        { kind: 'clip', track: 'broll', clipId: 'clip-broll-9' },
        { kind: 'logo' },
      ]),
    ).toBe('asset, tracks.broll clip clip-broll-9, logo');
  });

  it('describes an empty list as an empty string', () => {
    expect(describeTimelineAssetReferences([])).toBe('');
  });
});
