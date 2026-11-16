import { canonicalMaterialPath } from '@video-maker/timeline-core';
import type {
  MaterialReview,
  MaterialReviewItem,
  MaterialWarnings,
} from '@video-maker/timeline-core';

import { orderedAssetRoles } from '../../api/asset-roles';
import type { AssetListEntry, AssetRole } from '../../api/render-api-types';

export type RoleFilter = 'all' | AssetRole;
export type ThumbnailSize = 'm' | 'l';
export type RoleSummaryStatus = 'complete' | 'missing' | 'review' | 'empty';

export type RoleSummaryEntry = {
  role: AssetRole;
  count: number;
  status: RoleSummaryStatus;
};

const HIDDEN_WHEN_EMPTY: readonly AssetRole[] = ['voice', 'reference'];

export function filterAssets(
  assets: readonly AssetListEntry[],
  filter: RoleFilter,
): AssetListEntry[] {
  return filter === 'all'
    ? [...assets]
    : assets.filter((asset) => asset.role === filter);
}

export function orderAssetsByRole(
  assets: readonly AssetListEntry[],
  roles: readonly AssetRole[],
): AssetListEntry[] {
  return orderedAssetRoles(roles).flatMap((copy) =>
    assets.filter((asset) => asset.role === copy.role),
  );
}

export function filterableRoles(
  assets: readonly AssetListEntry[],
  roles: readonly AssetRole[],
): AssetRole[] {
  return orderedAssetRoles(roles)
    .map((copy) => copy.role)
    .filter((role) => assets.some((asset) => asset.role === role));
}

export function flaggedAssetPaths(
  warnings: MaterialWarnings | null,
): ReadonlySet<string> {
  return new Set(
    (warnings?.items ?? []).map((item) => canonicalMaterialPath(item.file)),
  );
}

export function reviewByAssetPath(
  review: MaterialReview | null,
): ReadonlyMap<string, MaterialReviewItem> {
  return new Map(
    (review?.items ?? []).map((item) => [
      canonicalMaterialPath(item.file),
      item,
    ]),
  );
}

export function roleSummary(
  assets: readonly AssetListEntry[],
  roles: readonly AssetRole[],
  primaryRole: AssetRole,
  flagged: ReadonlySet<string>,
): RoleSummaryEntry[] {
  return orderedAssetRoles(roles).flatMap((copy): RoleSummaryEntry[] => {
    const ofRole = assets.filter((asset) => asset.role === copy.role);
    if (ofRole.length === 0) {
      if (HIDDEN_WHEN_EMPTY.includes(copy.role)) {
        return [];
      }
      return [
        {
          role: copy.role,
          count: 0,
          status: copy.role === primaryRole ? 'missing' : 'empty',
        },
      ];
    }
    const needsReview = ofRole.some((asset) => flagged.has(asset.path));
    return [
      {
        role: copy.role,
        count: ofRole.length,
        status: needsReview ? 'review' : 'complete',
      },
    ];
  });
}

export function toggleSelection(
  selected: readonly string[],
  path: string,
): string[] {
  return selected.includes(path)
    ? selected.filter((candidate) => candidate !== path)
    : [...selected, path];
}

export function pruneSelection(
  selected: readonly string[],
  assets: readonly AssetListEntry[],
): string[] {
  const existing = new Set(assets.map((asset) => asset.path));
  return selected.filter((path) => existing.has(path));
}

export function thumbnailColumns(size: ThumbnailSize): string {
  return size === 'l'
    ? 'grid-cols-[repeat(auto-fill,minmax(14rem,1fr))]'
    : 'grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))]';
}
