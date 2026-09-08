import type { MediaKind } from '@video-maker/timeline-core';

import type { Catalog } from '../catalog/catalog.schema';
import type { MontagePreset } from '../presets/montage-preset';
import { assetTokens } from './asset-tokens';

export interface BrollCandidate {
  readonly assetId: string;
  readonly role: 'broll' | 'image';
  readonly kind: MediaKind;
  readonly durationMs: number;
  readonly tokens: ReadonlySet<string>;
}

function isBrollIndexRole(role: Catalog['assets'][number]['role']): role is 'broll' | 'image' {
  return role === 'broll' || role === 'image';
}

function compareAssetIdAscending(left: BrollCandidate, right: BrollCandidate): number {
  return left.assetId < right.assetId ? -1 : 1;
}

export function buildBrollIndex(
  catalog: Catalog,
  preset: MontagePreset,
): readonly BrollCandidate[] {
  const candidates: BrollCandidate[] = [];

  catalog.assets.forEach((catalogAsset) => {
    if (!isBrollIndexRole(catalogAsset.role)) {
      return;
    }

    const tokens = assetTokens(catalogAsset.asset.path, preset.concepts.minTermLength);
    if (tokens.size === 0) {
      return;
    }

    candidates.push({
      assetId: catalogAsset.asset.id,
      role: catalogAsset.role,
      kind: catalogAsset.asset.kind,
      durationMs: catalogAsset.asset.durationMs,
      tokens,
    });
  });

  return candidates.sort(compareAssetIdAscending);
}
