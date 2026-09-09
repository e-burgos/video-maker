import { CatalogSchema } from '@video-maker/auto-montage';
import type { Catalog, CatalogAsset } from '@video-maker/auto-montage';
import type { MediaAsset } from '@video-maker/timeline-core';

import { emptyCatalogFor, toCatalogAsset } from '../store/catalog-merge';

const PROBED_AT = '2026-09-08T00:00:00.000Z';

export function buildMinimalMediaAsset(overrides?: Partial<MediaAsset>): MediaAsset {
  return {
    id: 'raw/aroll/clip01.mp4',
    kind: 'video',
    path: 'raw/aroll/clip01.mp4',
    durationMs: 12000,
    fps: 30,
    width: 1080,
    height: 1920,
    hasAudio: true,
    probedAt: PROBED_AT,
    ...overrides,
  };
}

export interface CatalogAssetFixtureInput {
  readonly assetId?: string;
  readonly role?: CatalogAsset['role'];
  readonly sizeBytes?: number;
  readonly modifiedAtMs?: number;
}

export function buildCatalogAssetFixture(input?: CatalogAssetFixtureInput): CatalogAsset {
  const assetId = input?.assetId ?? 'raw/aroll/clip01.mp4';

  return toCatalogAsset({
    asset: buildMinimalMediaAsset({ id: assetId, path: assetId }),
    assetId,
    role: input?.role ?? 'aroll',
    fingerprint: {
      sizeBytes: input?.sizeBytes ?? 10_485_760,
      modifiedAtMs: input?.modifiedAtMs ?? 1_757_289_600_000,
    },
  });
}

export function buildCatalogFixture(slug: string, assets: readonly CatalogAsset[]): Catalog {
  return CatalogSchema.parse({ ...emptyCatalogFor(slug), assets });
}
