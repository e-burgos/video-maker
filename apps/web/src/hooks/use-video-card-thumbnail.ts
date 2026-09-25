import { useCallback } from 'react';

import { groupGeneratedFiles } from '../api/generated-files';
import { useRenderApi } from '../api/render-api-context';
import { useAsyncResource } from './use-async-resource';
import type { AsyncResourceStatus } from './use-async-resource';
import type { RenderApiClient } from '../api/render-api-client';

export type VideoCardThumbnailSource = {
  path: string;
  modifiedAtMs: number;
};

async function loadThumbnailSource(
  client: RenderApiClient,
  slug: string,
): Promise<VideoCardThumbnailSource | null> {
  const generated = await client.listGenerated(slug);
  const deliverables = [...groupGeneratedFiles(generated).deliverables].sort(
    (left, right) => right.modifiedAtMs - left.modifiedAtMs,
  );
  const latestDeliverable = deliverables[0];
  if (latestDeliverable !== undefined) {
    return { path: latestDeliverable.path, modifiedAtMs: latestDeliverable.modifiedAtMs };
  }

  const assets = await client.listAssets(slug);
  const firstAroll = assets.assets.find((asset) => asset.role === 'aroll');
  return firstAroll === undefined
    ? null
    : { path: firstAroll.path, modifiedAtMs: firstAroll.fingerprint.modifiedAtMs };
}

export type UseVideoCardThumbnailResult = {
  source: VideoCardThumbnailSource | null;
  status: AsyncResourceStatus;
};

export function useVideoCardThumbnail(slug: string): UseVideoCardThumbnailResult {
  const client = useRenderApi();
  const load = useCallback(() => loadThumbnailSource(client, slug), [client, slug]);
  const resource = useAsyncResource<VideoCardThumbnailSource | null>(load, `video-card-thumbnail:${slug}`);
  return { source: resource.data, status: resource.status };
}
