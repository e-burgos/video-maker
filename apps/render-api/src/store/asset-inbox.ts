import type { MediaAsset } from '@video-maker/timeline-core';

import type { ObjectStorage } from '../deps/object-storage';
import type { AssetProbeSummary } from './propose-asset-role';

export const INBOX_RAW_DIRECTORY = 'raw/inbox';

export function inboxAssetId(fileName: string): string {
  return `${INBOX_RAW_DIRECTORY}/${fileName}`;
}

export function withSuffix(fileName: string, attempt: number): string {
  if (attempt <= 1) {
    return fileName;
  }

  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex <= 0) {
    return `${fileName}-${String(attempt)}`;
  }

  return `${fileName.slice(0, dotIndex)}-${String(attempt)}${fileName.slice(dotIndex)}`;
}

export async function pickAvailableFileName(
  storage: Pick<ObjectStorage, 'stat'>,
  directoryAbsolutePath: string,
  fileName: string,
): Promise<string> {
  let attempt = 1;
  for (;;) {
    const candidate = withSuffix(fileName, attempt);
    const existing = await storage.stat(`${directoryAbsolutePath}/${candidate}`);
    if (existing === null) {
      return candidate;
    }
    attempt += 1;
  }
}

export function toAssetProbeSummary(asset: MediaAsset): AssetProbeSummary {
  return {
    kind: asset.kind,
    durationMs: asset.durationMs,
    ...(asset.width === undefined ? {} : { width: asset.width }),
    ...(asset.height === undefined ? {} : { height: asset.height }),
    ...(asset.hasAudio === undefined ? {} : { hasAudio: asset.hasAudio }),
    ...(asset.hasAlpha === undefined ? {} : { hasAlpha: asset.hasAlpha }),
  };
}
