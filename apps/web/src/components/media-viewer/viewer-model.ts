import { assetMediaKind, formatDuration } from '../../api/asset-media-kind';
import type { AssetMediaKind } from '../../api/asset-media-kind';
import type { AssetListEntry, AssetRole } from '../../api/render-api-types';

export type ViewerItem = {
  path: string;
  role: AssetRole;
  kind: AssetMediaKind;
  sizeBytes: number;
  facts: string[];
};

export function viewerItemOf(asset: AssetListEntry): ViewerItem {
  const media = asset.media;
  const facts: string[] = [];
  if (media !== null) {
    if (media.width !== undefined && media.height !== undefined) {
      facts.push(`${media.width}×${media.height}`);
    }
    if (media.kind !== 'image') {
      facts.push(formatDuration(media.durationMs));
    }
    if (media.fps !== undefined) {
      facts.push(`${media.fps} fps`);
    }
  }
  return {
    path: asset.path,
    role: asset.role,
    kind: assetMediaKind(asset.path),
    sizeBytes: asset.fingerprint.sizeBytes,
    facts,
  };
}

export function stepIndex(
  count: number,
  index: number,
  direction: -1 | 1,
): number {
  return count === 0 ? 0 : (index + direction + count) % count;
}

export function comparePartnerIndex(
  items: readonly ViewerItem[],
  selected: readonly string[],
  currentIndex: number,
): number | null {
  if (items.length < 2) {
    return null;
  }
  const current = items[currentIndex];
  if (current === undefined) {
    return null;
  }
  const selectedIndexes = items.flatMap((item, index) =>
    selected.includes(item.path) ? [index] : [],
  );
  const others = selectedIndexes.filter((index) => index !== currentIndex);
  if (others.length > 0) {
    return (
      others.find((index) => index > currentIndex) ?? (others[0] as number)
    );
  }
  return stepIndex(items.length, currentIndex, 1);
}
